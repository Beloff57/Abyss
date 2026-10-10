/* =====================================================
   ABYSS — BELOFF STUDIO
   Main interaction and motion controller
===================================================== */

(() => {
  "use strict";

/* =====================================================
   ABYSS — BLUE TRANSLUCENT JELLYFISH
   Textured GLB + procedural swimming deformation
===================================================== */

function initHeroJellyfish() {
  const hero = document.querySelector(".hero");
  const canvas =
    document.getElementById("fishCanvas") ||
    document.getElementById("jellyfishCanvas");

  if (!hero || !canvas) return;

  const MODEL_URL = "./assets/jellyfish/jellyfish.glb";

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  import("three")
    .then(async (THREE) => {
      const { GLTFLoader } = await import(
        "three/addons/loaders/GLTFLoader.js"
      );

      let renderer;

      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance"
        });
      } catch (error) {
        canvas.hidden = true;
        console.warn("ABYSS: WebGL unavailable.", error);
        return;
      }

      const pixelRatioCap =
  window.innerWidth <= 900 ? 2 : 2.5;

renderer.setPixelRatio(
  Math.min(
    Math.max(window.devicePixelRatio || 1, 2),
    pixelRatioCap
  )
);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const scene = new THREE.Scene();

      const camera = new THREE.OrthographicCamera(
        -7, 7, 4, -4, 0.1, 100
      );

      camera.position.set(0, 0, 18);
      camera.lookAt(0, 0, 0);

      /* UNDERWATER LIGHTING */

      scene.add(
        new THREE.HemisphereLight(
          0xa9e7ff,
          0x03111e,
          1.65
        )
      );

      const keyLight = new THREE.DirectionalLight(
        0xa5efff,
        2.45
      );

      keyLight.position.set(-3, 4, 7);
      scene.add(keyLight);

      const cyanLight = new THREE.PointLight(
        0x20c8ef,
        17,
        17
      );

      cyanLight.position.set(-2.5, 1.6, 4);
      scene.add(cyanLight);

      const violetLight = new THREE.PointLight(
        0x638eff,
        5.5,
        13
      );

      violetLight.position.set(2.5, -1.5, -2.5);
      scene.add(violetLight);

      /* MODEL HIERARCHY */

      const jellyfishRoot = new THREE.Group();
const facingGroup = new THREE.Group();
const tiltGroup = new THREE.Group();
const modelHolder = new THREE.Group();

scene.add(jellyfishRoot);

jellyfishRoot.add(facingGroup);
facingGroup.add(tiltGroup);
tiltGroup.add(modelHolder);

      const clamp = THREE.MathUtils.clamp;

      const randomBetween = (min, max) =>
        min + Math.random() * (max - min);

      const damp = (from, to, speed, dt) =>
        from + (to - from) *
        (1 - Math.exp(-speed * dt));

      let viewWidth = 14;
      let viewHeight = 8;

      let modelHeight = 0;
      let bellAnchorY = 0;
      let modelCenter = new THREE.Vector3();

      let loaded = false;
      let running = false;
      let rafId = 0;
      let elapsed = 0;
      let lastFrame = 0;
      let nextWanderAt = 3.5;

      let x = 0;
      let y = 0;
      let previousX = 0;
      let previousY = 0;

      let pointerX = 0;
      let pointerY = 0;

      let wanderX = 0;
      let wanderY = 0;

      let pointerActive = false;
      let currentLean = 0;
      let currentYaw = 0;
let currentPitch = 0;
      let mixer = null;

      const timeUniform = { value: 0 };
      const recoloredTextures = [];

      /* TEXTURE RECOLORING */

      function makeOceanTexture(sourceTexture) {
        const source = sourceTexture && sourceTexture.image;

        if (!source) return sourceTexture;

        const width =
          source.naturalWidth ||
          source.videoWidth ||
          source.width;

        const height =
          source.naturalHeight ||
          source.videoHeight ||
          source.height;

        if (!width || !height) return sourceTexture;

        try {
          const work = document.createElement("canvas");
          work.width = width;
          work.height = height;

          const ctx = work.getContext(
            "2d",
            { willReadFrequently: true }
          );

          if (!ctx) return sourceTexture;

          ctx.drawImage(source, 0, 0, width, height);

          const imageData = ctx.getImageData(
            0, 0, width, height
          );

          const pixels = imageData.data;

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const alpha = pixels[i + 3];

            if (alpha === 0) continue;

            const lum = (
              0.2126 * r +
              0.7152 * g +
              0.0722 * b
            ) / 255;

            const isMagentaIsland =
              r > g * 1.16 &&
              b > g * 1.12;

            if (isMagentaIsland) {
              // Purple regions become bright cyan highlights.
              pixels[i] = Math.round(58 + lum * 115);
              pixels[i + 1] = Math.round(154 + lum * 82);
              pixels[i + 2] = Math.round(218 + lum * 34);
            } else {
              // Blue regions become deep ocean blue.
              pixels[i] = Math.round(4 + lum * 22);
              pixels[i + 1] = Math.round(35 + lum * 99);
              pixels[i + 2] = Math.round(72 + lum * 153);
            }
          }

          ctx.putImageData(imageData, 0, 0);

          const texture = new THREE.CanvasTexture(work);

          texture.flipY = sourceTexture.flipY;
          texture.wrapS = sourceTexture.wrapS;
          texture.wrapT = sourceTexture.wrapT;

          texture.repeat.copy(sourceTexture.repeat);
          texture.offset.copy(sourceTexture.offset);
          texture.center.copy(sourceTexture.center);
          texture.rotation = sourceTexture.rotation;

          texture.colorSpace = THREE.SRGBColorSpace;

          texture.anisotropy = Math.min(
            renderer.capabilities.getMaxAnisotropy(),
            16
          );

          texture.needsUpdate = true;
          recoloredTextures.push(texture);

          return texture;
        } catch (error) {
          console.warn(
            "ABYSS: using original jellyfish texture.",
            error
          );

          return sourceTexture;
        }
      }

      /* TRANSLUCENT BLUE MATERIAL */

      function tuneMaterial(sourceMaterial) {
        const material = sourceMaterial.clone();

        if (material.map) {
          material.map = makeOceanTexture(material.map);
        }

        material.color.set(0xf0fbff);

material.transparent = true;
material.opacity = 0.92;

        // Avoid writing translucent surfaces into the depth buffer.
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
        material.blending = THREE.NormalBlending;

        if ("roughness" in material) {
          material.roughness = 0.22;
        }

        if ("metalness" in material) {
          material.metalness = 0.04;
        }

        if ("clearcoat" in material) {
          material.clearcoat = 1.0;
        }

        if ("clearcoatRoughness" in material) {
          material.clearcoatRoughness = 0.16;
        }

        if (material.emissive) {
          material.emissive.set(0x0b6487);
        }

        if ("emissiveIntensity" in material) {
          material.emissiveIntensity = 0.52;
        }

        /* ANIMATE THE MESH ITSELF */

        material.onBeforeCompile = (shader) => {
          shader.uniforms.uAbyssJellyTime = timeUniform;

          shader.vertexShader =
            shader.vertexShader.replace(
              "#include <common>",
              "#include <common>\nuniform float uAbyssJellyTime;"
            );

          shader.vertexShader =
            shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>

                // The Y axis remains vertical:
                // upper bell stays relatively stable.
                float tentacleMask =
                  1.0 - smoothstep(
                    -0.78,
                    0.34,
                    position.y
                  );

                // Travelling waves move the lower tissue
                // with varying phases across the surface.
                float waveA = sin(
                  uAbyssJellyTime * 0.88
                  + position.y * 3.1
                  + position.x * 2.0
                  + position.z * 1.4
                );

                float waveB = cos(
                  uAbyssJellyTime * 0.63
                  + position.y * 2.25
                  - position.z * 2.2
                );

                transformed.x += tentacleMask *
                  (waveA * 0.078 + waveB * 0.022);

                transformed.z += tentacleMask * cos(
                  uAbyssJellyTime * 0.79
                  + position.y * 2.75
                  + position.x * 1.7
                ) * 0.052;

                // Gentle bell pulse.
                float bellMask =
                  smoothstep(0.42, 0.82, position.y);

                float pulse =
                  sin(uAbyssJellyTime * 1.55);

                transformed.xz *=
                  1.0 + pulse * 0.014 * bellMask;

                transformed.y +=
                  pulse * 0.016 * bellMask;
              `
            );
        };

        material.customProgramCacheKey = () =>
          "abyss-jellyfish-v1";

        material.needsUpdate = true;

        return material;
      }

      /* SIZE AND POSITION */

      function fitModel() {
        if (!modelHeight) return;

        const mobile = window.matchMedia(
          "(max-width: 900px)"
        ).matches;

        const targetHeight = Math.min(
  viewHeight * (mobile ? 0.27 : 0.30),
  mobile ? 1.80 : 2.45
);

        const scale = targetHeight / modelHeight;

        modelHolder.scale.setScalar(scale);

        // Anchor the bell, not the full model's bounding centre.
        modelHolder.position.set(
          -modelCenter.x * scale,
          -bellAnchorY * scale,
          -modelCenter.z * scale
        );
      }

      function resizeScene() {
        const width = Math.max(hero.clientWidth, 1);
        const height = Math.max(hero.clientHeight, 1);

        viewWidth = width / 100;
        viewHeight = height / 100;

        camera.left = -viewWidth / 2;
        camera.right = viewWidth / 2;
        camera.top = viewHeight / 2;
        camera.bottom = -viewHeight / 2;

        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);

        fitModel();

        if (loaded) {
          const mobile = window.matchMedia(
            "(max-width: 900px)"
          ).matches;

          x = clamp(
            x,
            viewWidth * 0.02,
            viewWidth * (mobile ? 0.40 : 0.42)
          );

          wanderX = clamp(
            wanderX,
            viewWidth * 0.02,
            viewWidth * 0.42
          );

          pointerX = clamp(
            pointerX,
            viewWidth * 0.02,
            viewWidth * 0.42
          );

          y = clamp(y, -viewHeight * 0.35, viewHeight * 0.36);

          wanderY = clamp(
            wanderY,
            -viewHeight * 0.35,
            viewHeight * 0.36
          );

          pointerY = clamp(
            pointerY,
            -viewHeight * 0.35,
            viewHeight * 0.36
          );
        }
      }

      /* ANIMATION LIFECYCLE */

      function startAnimation() {
        if (running || reducedMotion || !loaded) return;

        running = true;
        lastFrame = 0;

        rafId = requestAnimationFrame(animate);
      }

      function stopAnimation() {
        running = false;

        if (rafId) {
          cancelAnimationFrame(rafId);
        }

        rafId = 0;
      }

      /* CURSOR TRACKING */

      hero.addEventListener(
        "pointermove",
        (event) => {
          if (
            event.pointerType === "touch" ||
            reducedMotion
          ) {
            return;
          }

          const rect = hero.getBoundingClientRect();

          const nx = clamp(
            (event.clientX - rect.left) / rect.width,
            0, 1
          );

          const ny = clamp(
            (event.clientY - rect.top) / rect.height,
            0, 1
          );

          const mobile = window.matchMedia(
            "(max-width: 900px)"
          ).matches;

          // Preserve room for the Hero title on the left.
          pointerX = viewWidth * (
            0.02 + nx * (mobile ? 0.35 : 0.40)
          );

          pointerY = (0.5 - ny) * viewHeight * 0.72;

          pointerX = clamp(
            pointerX,
            viewWidth * 0.02,
            viewWidth * 0.42
          );

          pointerY = clamp(
            pointerY,
            -viewHeight * 0.36,
            viewHeight * 0.36
          );

          pointerActive = true;
        },
        { passive: true }
      );

      hero.addEventListener(
        "pointerleave",
        () => {
          pointerActive = false;

          // Continue from current position without snapping.
          wanderX = clamp(
            x + randomBetween(
              -viewWidth * 0.12,
              viewWidth * 0.12
            ),
            viewWidth * 0.02,
            viewWidth * 0.40
          );

          wanderY = clamp(
            y + randomBetween(
              -viewHeight * 0.13,
              viewHeight * 0.13
            ),
            -viewHeight * 0.34,
            viewHeight * 0.34
          );

          nextWanderAt =
            elapsed + randomBetween(2.0, 3.5);
        },
        { passive: true }
      );

      window.addEventListener(
        "resize",
        resizeScene,
        { passive: true }
      );

      /* LOAD GLB */

      const loader = new GLTFLoader();

      loader.load(
        MODEL_URL,

        (gltf) => {
          const model = gltf.scene;

          model.updateMatrixWorld(true);

          const bounds = new THREE.Box3()
            .setFromObject(model);

          if (bounds.isEmpty()) {
            canvas.hidden = true;

            console.warn(
              "ABYSS: jellyfish model has no visible geometry."
            );

            return;
          }

          const size = bounds.getSize(
            new THREE.Vector3()
          );

          modelCenter = bounds.getCenter(
            new THREE.Vector3()
          );

          modelHeight = size.y;

          if (modelHeight < 0.001) {
            canvas.hidden = true;

            console.warn(
              "ABYSS: invalid jellyfish model height."
            );

            return;
          }

          /*
            Source model uses Y-up:
            dome at the top, tentacles below.

            The cursor anchor is placed around the bell,
            so we do not rotate the model to face the cursor.
          */

          bellAnchorY =
            bounds.max.y - modelHeight * 0.23;

          model.traverse((node) => {
            if (!node.isMesh) return;

            node.frustumCulled = false;

            const oldMaterials = Array.isArray(node.material)
              ? node.material
              : [node.material];

            const newMaterials =
              oldMaterials.map(tuneMaterial);

            node.material = Array.isArray(node.material)
              ? newMaterials
              : newMaterials[0];
          });

          modelHolder.add(model);
          fitModel();

          // Keep any existing glTF animation if one is present.
          if (
            gltf.animations &&
            gltf.animations.length > 0
          ) {
            mixer = new THREE.AnimationMixer(model);

            const clip = gltf.animations.find((item) =>
              /jelly|swim|pulse|idle/i.test(item.name)
            ) || gltf.animations[0];

            mixer
              .clipAction(clip)
              .setLoop(THREE.LoopRepeat, Infinity)
              .play();
          }

          x = viewWidth * 0.25;
          y = viewHeight * 0.10;

          previousX = x;
          previousY = y;

          pointerX = x;
          pointerY = y;

          wanderX = x - viewWidth * 0.035;
          wanderY = y - viewHeight * 0.035;

          nextWanderAt =
            randomBetween(3.5, 5.0);

          jellyfishRoot.position.set(x, y, 0);

          canvas.classList.add("is-ready");

          loaded = true;

          renderer.render(scene, camera);

          // Stop the render loop while Hero is off-screen.
          const observer = new IntersectionObserver(
            (entries) => {
              const visible = entries.some(
                (entry) => entry.isIntersecting
              );

              if (visible) startAnimation();
              else stopAnimation();
            },
            { threshold: 0.01 }
          );

          observer.observe(hero);

          document.addEventListener(
            "visibilitychange",
            () => {
              if (document.hidden) {
                stopAnimation();
              } else {
                const rect = hero.getBoundingClientRect();

                if (
                  rect.bottom > 0 &&
                  rect.top < window.innerHeight
                ) {
                  startAnimation();
                }
              }
            }
          );

          if (reducedMotion) {
            renderer.render(scene, camera);
          }
        },

        undefined,

        (error) => {
          canvas.hidden = true;

          console.warn(
            `ABYSS: could not load ${MODEL_URL}. ` +
            "Check that jellyfish.glb exists at that path.",
            error
          );
        }
      );

      /* NATURAL SWIMMING */

      function animate(now) {
        if (!running || !loaded) return;

        if (document.hidden) {
          lastFrame = now;
          rafId = requestAnimationFrame(animate);
          return;
        }

        const dt = Math.min(
          lastFrame
            ? (now - lastFrame) / 1000
            : 0.016,
          0.04
        );

        lastFrame = now;
        elapsed += dt;
        timeUniform.value = elapsed;

        if (mixer) {
          mixer.update(dt);
        }

        /*
          Autonomous wandering: choose a new waypoint,
          then approach it slowly.
        */

        if (
          !pointerActive &&
          elapsed >= nextWanderAt
        ) {
          wanderX = randomBetween(
            viewWidth * 0.10,
            viewWidth * 0.39
          );

          wanderY = randomBetween(
            -viewHeight * 0.28,
            viewHeight * 0.29
          );

          nextWanderAt =
            elapsed + randomBetween(3.3, 6.5);
        }

        const targetX = pointerActive
          ? pointerX
          : wanderX;

        const targetY = pointerActive
          ? pointerY
          : wanderY;

        const followSpeed = pointerActive
          ? 1.05
          : 0.32;

        x = damp(x, targetX, followSpeed, dt);
        y = damp(y, targetY, followSpeed, dt);

        /* MOTION VECTOR */

const vx =
  (x - previousX) / Math.max(dt, 0.001);

const vy =
  (y - previousY) / Math.max(dt, 0.001);

previousX = x;
previousY = y;


/* 1. SMOOTH 3D TURN */

const horizontalLead = clamp(
  (targetX - x) * 1.35,
  -1,
  1
);

const velocityTurn = clamp(
  vx * 0.22,
  -0.28,
  0.28
);

const yawTarget = clamp(
  horizontalLead * 0.72 + velocityTurn,
  -0.78,
  0.78
);

currentYaw = damp(
  currentYaw,
  yawTarget,
  1.7,
  dt
);

facingGroup.rotation.y =
  currentYaw +
  Math.sin(elapsed * 0.34) * 0.025;


/* 2. NATURAL SIDE TILT */

// Lean slightly into horizontal movement.
const horizontalIntent = clamp(
  (targetX - x) * 1.7,
  -1,
  1
);

// A small independent sway continues during idle.
const idleRoll =
  Math.sin(elapsed * 0.74) * 0.035 +
  Math.sin(elapsed * 0.41 + 1.2) * 0.018;

const leanTarget = clamp(
  -horizontalIntent * 0.21 -
  clamp(vx * 0.045, -0.08, 0.08) +
  idleRoll,
  -0.28,
  0.28
);

currentLean = damp(
  currentLean,
  leanTarget,
  1.35,
  dt
);

tiltGroup.rotation.z = currentLean;


/* 3. VERTICAL TILT */

// The bell subtly tilts when ascending or descending.
const verticalIntent = clamp(
  (targetY - y) * 1.7,
  -1,
  1
);

const idlePitch =
  Math.sin(elapsed * 0.57 + 0.8) * 0.022;

const pitchTarget = clamp(
  verticalIntent * 0.16 -
  clamp(vy * 0.035, -0.07, 0.07) +
  idlePitch,
  -0.20,
  0.20
);

currentPitch = damp(
  currentPitch,
  pitchTarget,
  1.2,
  dt
);

tiltGroup.rotation.x = currentPitch;

        /*
          Subtle drifting is added only when the cursor
          is not actively controlling the bell.
        */

        const driftX = pointerActive
          ? 0
          : Math.sin(elapsed * 0.36) * 0.035;

        const driftY = pointerActive
          ? 0
          : Math.sin(elapsed * 0.53) * 0.045;

        jellyfishRoot.position.set(
          x + driftX,
          y + driftY,
          Math.sin(elapsed * 0.31) * 0.055
        );

        cyanLight.intensity =
          16.0 + Math.sin(elapsed * 0.52) * 1.1;

        violetLight.intensity =
          5.2 + Math.sin(elapsed * 0.39 + 1.2) * 0.8;

        renderer.render(scene, camera);

        rafId = requestAnimationFrame(animate);
      }
    })
    .catch((error) => {
      canvas.hidden = true;

      console.warn(
        "ABYSS: Three.js could not initialize the jellyfish.",
        error
      );
    });
}

initHeroJellyfish();

  /* 01. INITIAL SETTINGS */

  if (!window.gsap || !window.ScrollTrigger) {
    console.error(
      "ABYSS: GSAP or ScrollTrigger failed to load."
    );
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const isMobile = () => window.innerWidth <= 900;

  const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, value));
  };

  const lerp = (start, end, amount) => {
    return start + (end - start) * amount;
  };


  /* 02. LENIS — SMOOTH SCROLL */

  let lenis = null;

  if (window.Lenis) {
    lenis = new Lenis({
      lerp: prefersReducedMotion ? 0.14 : 0.075,
      smoothWheel: !prefersReducedMotion,
      syncTouch: false
    });

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  }


  /* 03. CUSTOM CURSOR */

  const cursor = document.querySelector(".cursor");
  const cursorDot = document.querySelector(".cursor-dot");
  const cursorRing = document.querySelector(".cursor-ring");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  let ringX = mouseX;
  let ringY = mouseY;

  if (cursor && cursorDot && cursorRing) {
    window.addEventListener("mousemove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;

      gsap.to(cursorDot, {
        x: mouseX,
        y: mouseY,
        duration: 0.08,
        ease: "power2.out",
        overwrite: true
      });
    });

    const cursorLoop = () => {
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;

      gsap.set(cursorRing, {
        x: ringX,
        y: ringY
      });

      requestAnimationFrame(cursorLoop);
    };

    cursorLoop();

    document
      .querySelectorAll("a, button")
      .forEach((element) => {
        element.addEventListener("mouseenter", () => {
          cursor.classList.add("is-hover");
        });

        element.addEventListener("mouseleave", () => {
          cursor.classList.remove("is-hover");
        });
      });
  }


  /* 04. MAGNETIC BUTTONS */

  document
    .querySelectorAll(".magnetic")
    .forEach((element) => {
      element.addEventListener("mousemove", (event) => {
        if (isMobile() || prefersReducedMotion) {
          return;
        }

        const rect = element.getBoundingClientRect();

        const x =
          event.clientX -
          rect.left -
          rect.width / 2;

        const y =
          event.clientY -
          rect.top -
          rect.height / 2;

        gsap.to(element, {
          x: x * 0.1,
          y: y * 0.1,
          duration: 0.45,
          ease: "power3.out",
          overwrite: true
        });
      });

      element.addEventListener("mouseleave", () => {
        gsap.to(element, {
          x: 0,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
          overwrite: true
        });
      });
    });


  /* 05. HERO INTRO */

  const heroReveal = gsap.timeline({
    defaults: {
      ease: "power4.out"
    }
  });

  heroReveal
    .to(".hero .reveal-up", {
      opacity: 1,
      y: 0,
      duration: prefersReducedMotion ? 0.01 : 1.15,
      stagger: prefersReducedMotion ? 0 : 0.12
    })
    .from(
      ".hero-media img",
      {
        scale: prefersReducedMotion ? 1 : 1.1,
        duration: prefersReducedMotion ? 0.01 : 2.1,
        ease: "power3.out"
      },
      0
    );


  /* 06. HERO IMAGE PARALLAX */

  if (!prefersReducedMotion) {
    gsap.to(".hero-media img", {
      yPercent: 11,
      scale: 1.1,
      ease: "none",

      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 1.2
      }
    });
  }


  /* 07. DEPTH UI REFERENCES */

  const depthNumber =
    document.getElementById("depthNumber");

  const headerDepth =
    document.getElementById("headerDepth");

  const depthProgress =
    document.querySelector(".depth-progress");

  const hudPressure =
    document.getElementById("hudPressure");

  const hudVisibility =
    document.getElementById("hudVisibility");

  const hudTemp =
    document.getElementById("hudTemp");

  const depthSignal =
    document.getElementById("depthSignal");

  const abyssStatusText =
    document.getElementById("abyssStatusText");

  const pressureHaze =
    document.querySelector(".pressure-haze");

  const panels = [
    ...document.querySelectorAll(".descent-panel")
  ];

  const depthMarkers = [
    ...document.querySelectorAll(".depth-marker")
  ];

  const visuals = [
    document.querySelector(".visual-one"),
    document.querySelector(".visual-two"),
    document.querySelector(".visual-three"),
    document.querySelector(".visual-four")
  ];

  const lightSweeps =
    document.querySelector(".light-sweeps");

  const returnPhrase =
    document.querySelector(".return-phrase");

  const returnPhraseText =
    document.querySelector(".return-phrase span");

  let currentDepth = 0;


  /* 08. AUDIO REFERENCES */

  const soundToggle =
    document.getElementById("soundToggle");

  let audioContext = null;
  let soundNodes = null;
  let soundEnabled = false;


  /* 09. DEPTH DATA */

  function activatePanel(index) {
    panels.forEach((panel, panelIndex) => {
      panel.classList.toggle(
        "is-active",
        panelIndex === index
      );
    });
  }


  function updateDepth(progress) {
    const depth = clamp(
      Math.round(progress * 60),
      0,
      60
    );

    currentDepth = depth;

    if (depthNumber) {
      depthNumber.textContent =
        String(depth).padStart(2, "0");
    }

    if (headerDepth) {
      headerDepth.textContent =
        String(depth).padStart(2, "0");
    }

    if (depthProgress) {
      depthProgress.style.height =
        `${progress * 100}%`;
    }

    /*
      Concept values for the fictional ABYSS brand.
      Replace with real location-specific data before
      presenting these as actual diving conditions.
    */

    const normalizedDepth = depth / 60;

    const pressure = lerp(
      1,
      7,
      normalizedDepth
    );

    const visibility = Math.max(
      3,
      Math.round(30 - depth * 0.44)
    );

    const temperature = Math.max(
      7,
      Math.round(27 - depth * 0.33)
    );

    if (hudPressure) {
      hudPressure.textContent =
        pressure.toFixed(1);
    }

    if (hudVisibility) {
      hudVisibility.textContent =
        String(visibility);
    }

    if (hudTemp) {
      hudTemp.textContent =
        String(temperature);
    }

    if (depthSignal && abyssStatusText) {
      if (depth < 10) {
        depthSignal.textContent =
          "SUNLIGHT / 0–10M";

        abyssStatusText.textContent =
          "DESCENT ACTIVE";
      } else if (depth < 25) {
        depthSignal.textContent =
          "COLOURS / 10–25M";

        abyssStatusText.textContent =
          "LIGHT FADING";
      } else if (depth < 42) {
        depthSignal.textContent =
          "THE BLUE / 25–42M";

        abyssStatusText.textContent =
          "ENTERING THE BLUE";
      } else if (depth < 55) {
        depthSignal.textContent =
          "LOW LIGHT / 42–55M";

        abyssStatusText.textContent =
          "LOW VISIBILITY";
      } else {
        depthSignal.textContent =
          "THE UNKNOWN / 55–60M";

        abyssStatusText.textContent =
          "ABYSS";
      }
    }

    const panelIndex =
      depth >= 43
        ? 3
        : depth >= 27
          ? 2
          : depth >= 10
            ? 1
            : 0;

    activatePanel(panelIndex);

    /*
      Sound responds to depth.
      The water ambience becomes darker as the
      scene descends.
    */

    if (
      audioContext &&
      soundNodes &&
      soundEnabled
    ) {
      const targetFrequency = lerp(
        620,
        190,
        normalizedDepth
      );

      soundNodes.filter.frequency.setTargetAtTime(
        targetFrequency,
        audioContext.currentTime,
        0.25
      );
    }
  }


  /* 10. PARTICLE SYSTEM */

  const particleCanvas =
    document.getElementById("particles");

  const particleContext =
    particleCanvas
      ? particleCanvas.getContext("2d")
      : null;

  let particles = [];
  let particleWidth = 0;
  let particleHeight = 0;


  function createParticles() {
    if (!particleCanvas || !particleContext) {
      return;
    }

    particleWidth = window.innerWidth;
    particleHeight = window.innerHeight;

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    particleCanvas.width =
      particleWidth * dpr;

    particleCanvas.height =
      particleHeight * dpr;

    particleCanvas.style.width =
      `${particleWidth}px`;

    particleCanvas.style.height =
      `${particleHeight}px`;

    particleContext.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    const count = isMobile() ? 48 : 105;

    particles = Array.from(
      { length: count },
      () => ({
        x: Math.random() * particleWidth,
        y: Math.random() * particleHeight,

        radius:
          Math.random() * 1.2 + 0.12,

        speed:
          Math.random() * 0.32 + 0.08,

        drift:
          Math.random() * 0.6 - 0.3,

        alpha:
          Math.random() * 0.28 + 0.05
      })
    );
  }


  function renderParticles() {
    if (!particleContext) {
      return;
    }

    particleContext.clearRect(
      0,
      0,
      particleWidth,
      particleHeight
    );

    const darkness = currentDepth / 60;

    particles.forEach((particle) => {
      particle.y -=
        particle.speed *
        (0.8 + darkness * 1.55);

      particle.x +=
        particle.drift *
        (0.06 + darkness * 0.025);

      if (particle.y < -10) {
        particle.y = particleHeight + 10;
        particle.x = Math.random() * particleWidth;
      }

      if (particle.x < -10) {
        particle.x = particleWidth + 10;
      }

      if (particle.x > particleWidth + 10) {
        particle.x = -10;
      }

      const alpha =
        particle.alpha *
        (1 - darkness * 0.76);

      particleContext.beginPath();

      particleContext.arc(
        particle.x,
        particle.y,
        particle.radius,
        0,
        Math.PI * 2
      );

      particleContext.fillStyle =
        `rgba(188, 239, 246, ${alpha})`;

      particleContext.fill();
    });

    requestAnimationFrame(renderParticles);
  }


  if (particleCanvas && particleContext) {
    createParticles();
    renderParticles();
  }


  /* 11. MAIN DESCENT TIMELINE */

  const descentSection =
    document.querySelector(".descent");

  if (descentSection) {
    const descentTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: descentSection,
        start: "top top",
        end: "bottom bottom",
        scrub: prefersReducedMotion ? 0.1 : 1.5,

        onUpdate: (self) => {
          updateDepth(self.progress);
        }
      }
    });

    /*
      Background starts at the surface and
      gradually becomes deep ocean blue.
    */

    descentTimeline
      .to(
        ".depth-bg",
        {
          scale: 1,
          duration: 0.22,
          ease: "none"
        },
        0
      )

      .to(
        ".sun-glow",
        {
          y: -145,
          scale: 0.48,
          opacity: 0,
          duration: 0.48,
          ease: "power2.inOut"
        },
        0.02
      )

      .to(
        ".light-rays",
        {
          yPercent: -22,
          opacity: 0,
          duration: 0.5,
          ease: "power2.inOut"
        },
        0.07
      )

      .to(
        ".caustics",
        {
          opacity: 0.09,
          scale: 1.04,
          duration: 0.65,
          ease: "none"
        },
        0.2
      )

      .to(
        pressureHaze,
        {
          opacity: 0.88,
          duration: 0.62,
          ease: "none"
        },
        0.39
      );

    /*
      Atmospheric diver image:
      it appears briefly, then disappears naturally.
    */

    descentTimeline
      .to(
        ".diver-layer img",
        {
          opacity: 0.78,
          scale: 1.07,
          duration: 0.2,
          ease: "power2.out"
        },
        0.17
      )

      .to(
        ".diver-layer img",
        {
          scale: 1.17,
          yPercent: -7,
          opacity: 0.32,
          duration: 0.34,
          ease: "none"
        },
        0.39
      )

      .to(
        ".diver-layer img",
        {
          scale: 1.32,
          yPercent: -13,
          opacity: 0.055,
          duration: 0.3,
          ease: "none"
        },
        0.73
      )

      .to(
        ".diver-layer img",
        {
          opacity: 0,
          duration: 0.12
        },
        0.9
      );
  }


  /* 12. FLOATING VISUAL CARDS */

  if (descentSection && !prefersReducedMotion) {
    const visualsTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: descentSection,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.4
      }
    });

    if (visuals[0]) {
      visualsTimeline
        .to(
          visuals[0],
          {
            opacity: 1,
            y: -12,
            duration: 0.15
          },
          0.09
        )
        .to(
          visuals[0],
          {
            opacity: 0.16,
            y: -42,
            duration: 0.17
          },
          0.25
        );
    }

    if (visuals[1]) {
      visualsTimeline
        .to(
          visuals[1],
          {
            opacity: 1,
            y: -10,
            duration: 0.18
          },
          0.3
        )
        .to(
          visuals[1],
          {
            opacity: 0.15,
            y: -36,
            duration: 0.18
          },
          0.48
        );
    }

    if (visuals[2]) {
      visualsTimeline
        .to(
          visuals[2],
          {
            opacity: 1,
            y: -9,
            duration: 0.18
          },
          0.49
        )
        .to(
          visuals[2],
          {
            opacity: 0.1,
            y: -29,
            duration: 0.18
          },
          0.67
        );
    }

    if (visuals[3]) {
      visualsTimeline
        .to(
          visuals[3],
          {
            opacity: 1,
            y: -8,
            duration: 0.17
          },
          0.69
        )
        .to(
          visuals[3],
          {
            opacity: 0.04,
            y: -25,
            duration: 0.2
          },
          0.88
        );
    }
  }


  /* 13. ABSTRACT LIGHT EPISODE */

  if (
    descentSection &&
    lightSweeps &&
    returnPhrase &&
    returnPhraseText &&
    !prefersReducedMotion
  ) {
    const lightTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: descentSection,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.5
      }
    });

    lightTimeline
      .to(
        ".descent-copy",
        {
          opacity: 0.07,
          scale: 0.97,
          duration: 0.07,
          ease: "power2.inOut"
        },
        0.755
      )

      .to(
        ".descent-hud",
        {
          opacity: 0.05,
          duration: 0.07
        },
        0.76
      )

      .to(
        ".depth-indicator",
        {
          opacity: 0.16,
          duration: 0.07
        },
        0.76
      )

      .to(
        ".descent-signal",
        {
          opacity: 0.06,
          duration: 0.07
        },
        0.76
      )

      .to(
        lightSweeps,
        {
          opacity: 1,
          duration: 0.12,
          ease: "power2.inOut"
        },
        0.775
      )

      .to(
        ".sweep-a",
        {
          xPercent: 115,
          yPercent: 13,
          scale: 1.28,
          rotation: -9,
          duration: 0.17,
          ease: "sine.inOut"
        },
        0.78
      )

      .to(
        ".sweep-b",
        {
          xPercent: -125,
          yPercent: -11,
          scale: 1.3,
          rotation: 8,
          duration: 0.18,
          ease: "sine.inOut"
        },
        0.82
      )

      .to(
        ".sweep-c",
        {
          xPercent: 95,
          yPercent: -34,
          scale: 1.18,
          rotation: 5,
          duration: 0.18,
          ease: "sine.inOut"
        },
        0.865
      )

      .to(
        lightSweeps,
        {
          opacity: 0,
          scale: 1.08,
          duration: 0.16,
          ease: "power2.inOut"
        },
        0.925
      )

      .to(
        ".descent-copy",
        {
          opacity: 0.42,
          scale: 1,
          duration: 0.1,
          ease: "power2.out"
        },
        0.925
      )

      .to(
        ".descent-hud",
        {
          opacity: 0.35,
          duration: 0.1
        },
        0.925
      )

      .to(
        ".depth-indicator",
        {
          opacity: 0.62,
          duration: 0.1
        },
        0.925
      )

      .to(
        ".descent-signal",
        {
          opacity: 0.27,
          duration: 0.1
        },
        0.925
      )

      .to(
        returnPhrase,
        {
          opacity: 1,
          duration: 0.035
        },
        0.965
      )

      .to(
        returnPhraseText,
        {
          y: 0,
          duration: 0.08,
          ease: "power3.out"
        },
        0.968
      )

      .to(
        returnPhrase,
        {
          opacity: 0,
          duration: 0.08
        },
        0.987
      );
  }


  /* 14. DEPTH MARKERS */

  if (descentSection) {
    const thresholds = [5, 20, 40, 60];

    ScrollTrigger.create({
      trigger: descentSection,
      start: "top top",
      end: "bottom bottom",

      onUpdate: (self) => {
        const depth = self.progress * 60;

        depthMarkers.forEach((marker, index) => {
          const threshold =
            thresholds[index] ?? 60;

          marker.style.opacity =
            depth >= threshold ? "0.86" : "0.25";
        });
      }
    });
  }


  /* 15. SMOOTH SECTION REVEALS */

  if (!prefersReducedMotion) {
    gsap.utils
      .toArray(
        [
          ".statement-main",
          ".section-heading",
          ".experience-copy",
          ".risk-content",
          ".philosophy-copy"
        ].join(",")
      )
      .forEach((element) => {
        gsap.from(element, {
          y: 58,
          opacity: 0,
          duration: 1.15,
          ease: "power4.out",

          scrollTrigger: {
            trigger: element,
            start: "top 84%",
            toggleActions: "play none none reverse"
          }
        });
      });
  }


  /* 16. EXPERIENCE IMAGE PARALLAX */

  if (!prefersReducedMotion) {
    document
      .querySelectorAll(".experience-image img")
      .forEach((image) => {
        gsap.fromTo(
          image,
          {
            yPercent: -6
          },
          {
            yPercent: 6,
            ease: "none",

            scrollTrigger: {
              trigger: image,
              start: "top bottom",
              end: "bottom top",
              scrub: 1
            }
          }
        );
      });
  }


  /* 17. RISK SECTION PARALLAX */

  if (!prefersReducedMotion) {
    gsap.to(".risk-image img", {
      scale: 1.08,
      yPercent: -4,
      ease: "none",

      scrollTrigger: {
        trigger: ".risk",
        start: "top bottom",
        end: "bottom top",
        scrub: 1.2
      }
    });
  }


  /* 18. EXPLORE MICRO-INTERACTION */

  document
    .querySelectorAll(".circle-link")
    .forEach((button) => {
      button.addEventListener("mousemove", (event) => {
        if (isMobile() || prefersReducedMotion) {
          return;
        }

        const rect = button.getBoundingClientRect();

        const relativeX =
          (event.clientX - rect.left) / rect.width - 0.5;

        const relativeY =
          (event.clientY - rect.top) / rect.height - 0.5;

        gsap.to(button, {
          rotationX: -relativeY * 5,
          rotationY: relativeX * 5,
          duration: 0.45,
          ease: "power3.out",
          overwrite: true
        });
      });

      button.addEventListener("mouseleave", () => {
        gsap.to(button, {
          rotationX: 0,
          rotationY: 0,
          duration: 0.65,
          ease: "power3.out",
          overwrite: true
        });
      });
    });


  /* 19. OPTIONAL UNDERWATER AMBIENCE */

  function createNoiseBuffer(context) {
    const duration = 4;

    const buffer = context.createBuffer(
      1,
      context.sampleRate * duration,
      context.sampleRate
    );

    const data = buffer.getChannelData(0);

    let previous = 0;

    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;

      previous =
        previous * 0.97 +
        white * 0.12;

      data[i] = clamp(previous, -0.65, 0.65);
    }

    return buffer;
  }


  function buildSound() {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error(
        "Web Audio is not supported by this browser."
      );
    }

    audioContext = new AudioContextClass();

    /* Master volume */

    const master = audioContext.createGain();
    master.gain.value = 0.0001;
    master.connect(audioContext.destination);

    /* Filtered water ambience */

    const noiseSource =
      audioContext.createBufferSource();

    noiseSource.buffer =
      createNoiseBuffer(audioContext);

    noiseSource.loop = true;

    const filter =
      audioContext.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.65;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = 0.85;

    noiseSource
      .connect(filter)
      .connect(noiseGain)
      .connect(master);

    /* Low underwater drone */

    const drone = audioContext.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 54;

    const droneGain = audioContext.createGain();
    droneGain.gain.value = 0.17;

    drone
      .connect(droneGain)
      .connect(master);

    /* A quiet second tone */

    const upperTone = audioContext.createOscillator();
    upperTone.type = "sine";
    upperTone.frequency.value = 81;

    const upperGain = audioContext.createGain();
    upperGain.gain.value = 0.045;

    upperTone
      .connect(upperGain)
      .connect(master);

    /* Slow modulation */

    const lfo = audioContext.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;

    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 120;

    lfo
      .connect(lfoGain)
      .connect(filter.frequency);

    noiseSource.start();
    drone.start();
    upperTone.start();
    lfo.start();

    return {
      master,
      filter,
      noiseSource,
      drone,
      upperTone,
      lfo
    };
  }


  async function enableSound() {
    if (!audioContext) {
      soundNodes = buildSound();
    }

    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;

    soundNodes.master.gain.cancelScheduledValues(now);

    soundNodes.master.gain.setValueAtTime(
      Math.max(
        soundNodes.master.gain.value,
        0.0001
      ),
      now
    );

    soundNodes.master.gain.linearRampToValueAtTime(
      0.24,
      now + 1.4
    );

    soundEnabled = true;

    if (soundToggle) {
      soundToggle.textContent = "SOUND / ON";
      soundToggle.style.opacity = "0.88";
      soundToggle.setAttribute("aria-pressed", "true");
    }
  }


  function disableSound() {
    if (!audioContext || !soundNodes) {
      return;
    }

    const now = audioContext.currentTime;

    soundNodes.master.gain.cancelScheduledValues(now);

    soundNodes.master.gain.setValueAtTime(
      soundNodes.master.gain.value,
      now
    );

    soundNodes.master.gain.linearRampToValueAtTime(
      0.0001,
      now + 0.9
    );

    soundEnabled = false;

    if (soundToggle) {
      soundToggle.textContent = "SOUND / OFF";
      soundToggle.style.opacity = "0.42";
      soundToggle.setAttribute("aria-pressed", "false");
    }
  }


  if (soundToggle) {
    soundToggle.setAttribute("aria-pressed", "false");

    soundToggle.addEventListener("click", async () => {
      soundToggle.disabled = true;

      try {
        if (soundEnabled) {
          disableSound();
        } else {
          await enableSound();
        }
      } catch (error) {
        console.error(
          "ABYSS audio initialization failed:",
          error
        );

        soundToggle.textContent = "SOUND / UNAVAILABLE";
      } finally {
        soundToggle.disabled = false;
      }
    });
  }


  /* 20. SMOOTH ANCHOR NAVIGATION */

  document
    .querySelectorAll('a[href^="#"]')
    .forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const href = anchor.getAttribute("href");

        if (!href || href === "#") {
          return;
        }

        const target = document.querySelector(href);

        if (!target) {
          return;
        }

        event.preventDefault();

        if (lenis) {
          lenis.scrollTo(target, {
            duration: prefersReducedMotion ? 0.2 : 1.35,
            offset: -20
          });
        } else {
          target.scrollIntoView({
            behavior: prefersReducedMotion
              ? "auto"
              : "smooth"
          });
        }
      });
    });


  /* 21. RESIZE / REFRESH */

  let resizeTimeout = null;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
      createParticles();
      ScrollTrigger.refresh();
    }, 180);
  });


  window.addEventListener("load", () => {
    ScrollTrigger.refresh();
    updateDepth(0);
  });


  /* INITIAL STATE */

  updateDepth(0);

  console.info(
    "ABYSS motion system initialized."
  );

})();