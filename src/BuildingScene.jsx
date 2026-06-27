import { useEffect, useRef } from 'react';

export default function BuildingScene({ style, onReady, browseMode, rentals, onSelectRental, pageTurnRef, pageTurnReadyRef }) {
  const mountRef       = useRef(null);
  const browseModeRef  = useRef(browseMode);
  const rentalsRef     = useRef(rentals);
  const onSelectRef    = useRef(onSelectRental);
  const groundMatsRef  = useRef([]);
  const retextureRef   = useRef(false);

  useEffect(() => {
    browseModeRef.current = browseMode;
    groundMatsRef.current.forEach(({ mat, landColor, browseColor }) => {
      mat.color.set(browseMode ? browseColor : landColor);
    });
  }, [browseMode]);
  useEffect(() => {
    rentalsRef.current = rentals;
    // Force texture refresh when rentals change in browse mode
    if (browseModeRef.current) retextureRef.current = true;
  }, [rentals]);
  useEffect(() => { onSelectRef.current   = onSelectRental; }, [onSelectRental]);

  useEffect(() => {
    let renderer, animId;
    const mount = mountRef.current;
    if (!mount) return;

    function init(THREE) {
      const W = mount.clientWidth;
      const H = mount.clientHeight;

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(W, H);
      renderer.toneMapping        = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x6ab5a0);
      scene.fog        = new THREE.Fog(0x6ab5a0, 40, 90);

      const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
      camera.position.set(4, 3, 55);
      camera.lookAt(4, 2, 0);

      scene.add(new THREE.AmbientLight(0xbbffdd, 3.2));
      const sun     = new THREE.DirectionalLight(0xffffff, 4.0); sun.position.set(10, 20, 14); scene.add(sun);
      const skyFill = new THREE.DirectionalLight(0x55ddff, 1.0); skyFill.position.set(-8, 14,  4); scene.add(skyFill);
      const bounce  = new THREE.DirectionalLight(0x00ff88, 0.6); bounce.position.set( 0, -4, 10); scene.add(bounce);

      function smat(hex, rough = 0.45, metal = 0.05, offset = false) {
        return new THREE.MeshStandardMaterial({
          color: hex, roughness: rough, metalness: metal,
          polygonOffset: offset, polygonOffsetFactor: offset ? 1 : 0, polygonOffsetUnits: offset ? 1 : 0,
        });
      }

      // Building constants
      const ROWS = 18, COLS = 7;
      const WIN_W = 1.1, WIN_H = 1.3, GAP_X = 0.55, GAP_Y = 0.55;
      const CW   = WIN_W + GAP_X,  CH = WIN_H + GAP_Y;
      const BW   = COLS * CW + GAP_X, BH = ROWS * CH + GAP_Y, BD = 4.5;
      const SW   = 4.2, SD = 6.5;
      const SOX  = -BW / 2 - SW / 2 - 0.5, SOZ = -SD / 2 + BD / 2;
      const SCOLS = 3;
      const fc = 0xe8a820, rc = 0xffd84a, df = 0xb87c10;
      const groundY = -BH / 2 - 1.6;

      // Right-face constants
      const COLS_R       = 2;
      const RF_WALL_X    = BW / 2;
      const RF_WIN_X     = RF_WALL_X + 0.12;
      const RF_DETAIL_X  = RF_WALL_X + 0.175;
      const RF_LEDGE_X   = RF_WALL_X + 0.38;
      const RF_RAIL_X    = RF_WALL_X + 0.75;

      // Two symmetric windows centred on the face
      const RF_CENTER_GAP   = 0.7;
      const RF_OUTER_GAP    = (BD - 2 * WIN_W - RF_CENTER_GAP) / 2;  // = 0.8
      const RF_WIN_Z_CENTER = 0;

      // Browse camera
      const BROWSE_CAM_X  = -7.95 + 6;
      const BROWSE_CAM_Z  = -1.5;
      const BROWSE_LOOK_X = -7.95;

      // Scroll constants
      const INITIAL_SCROLL_Y = -14;
      const MIN_SCROLL_Y     = -17;
      const MAX_SCROLL_Y     =  14;

      // Returns the maximum scroll position
      function getMaxScrollY() {
        const n = rentalsRef.current.length;
        if (n === 0) return INITIAL_SCROLL_Y;
        const lastRow = Math.ceil(n / COLS_R);
        const lastRowY = -BH / 2 + GAP_Y + WIN_H / 2 + lastRow * CH;
        return Math.min(MAX_SCROLL_Y, lastRowY);
      }

      // Scene groups
      const buildingGroup = new THREE.Group();
      buildingGroup.position.x = -14;
      scene.add(buildingGroup);

      const NUM_SECTIONS     = 6;
      const ROWS_PER_SECTION = Math.ceil(ROWS / NUM_SECTIONS);
      const floorSections    = [];

      // Leaf/plant helpers
      const leafCols = [0x00cc44, 0x11ee55, 0x33ff66, 0x009933, 0x22dd55];
      function mkLeafMat() {
        return new THREE.MeshStandardMaterial({
          color: leafCols[Math.floor(Math.random() * leafCols.length)],
          emissive: 0x004422, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0,
          transparent: true, opacity: 0.88 + Math.random() * 0.1, side: THREE.DoubleSide,
        });
      }
      function leafGeo(lw, lh) {
        const s = new THREE.Shape();
        s.moveTo(0, -lh / 2);
        s.bezierCurveTo( lw * 0.55, -lh * 0.25,  lw * 0.62,  lh * 0.25, 0,  lh / 2);
        s.bezierCurveTo(-lw * 0.62,  lh * 0.25, -lw * 0.55, -lh * 0.25, 0, -lh / 2);
        return new THREE.ShapeGeometry(s, 10);
      }
      const stMat = new THREE.MeshLambertMaterial({ color: 0x007733 });

      const palettes = [
        { col: 0xfffacc, em: 0xffee66, ei: 1.3 }, { col: 0xffeebb, em: 0xffcc44, ei: 1.2 },
        { col: 0xffffff, em: 0xfff0cc, ei: 1.0 }, { col: 0x99ffee, em: 0x00ffcc, ei: 1.4 },
        { col: 0xaaddff, em: 0x44aaff, ei: 1.1 }, { col: 0xccffee, em: 0x66ffcc, ei: 1.2 },
        { col: 0xffeeff, em: 0xffaaff, ei: 0.9 }, { col: 0xddfff5, em: 0x88ffdd, ei: 1.0 },
      ];

      const frontWins     = []; 
      const rentalWindows = [];


      // Floor sections
      for (let sec = 0; sec < NUM_SECTIONS; sec++) {
        const secGroup = new THREE.Group();
        const rowStart = sec * ROWS_PER_SECTION;
        const rowEnd   = Math.min(rowStart + ROWS_PER_SECTION, ROWS);
        const secYBot  = -BH / 2 + rowStart * CH;
        const secYTop  = -BH / 2 + rowEnd   * CH;
        const secH     = secYTop - secYBot;
        const secYMid  = secYBot + secH / 2;

        // Concrete body & side wing
        const bodySlice = new THREE.Mesh(new THREE.BoxGeometry(BW, secH, BD), smat(0xffd4a8, 0.45, 0.08, true));
        bodySlice.position.set(0, secYMid, 0); secGroup.add(bodySlice);

        const sideSlice = new THREE.Mesh(new THREE.BoxGeometry(SW, secH, SD), smat(0xf5c898, 0.45, 0.08, true));
        sideSlice.position.set(SOX, secYMid, SOZ); secGroup.add(sideSlice);

        const cornerSlice = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, secH, Math.abs(SOZ) + SD / 2 + BD / 2 + 0.1),
          smat(0xffd4a8, 0.45, 0.05, true)
        );
        cornerSlice.position.set(-BW / 2 + 0.07, secYMid, (SOZ - BD / 2) / 2);
        secGroup.add(cornerSlice);

        // Front-face & side-wing floor bands
        for (let r = rowStart; r <= rowEnd; r++) {
          const y = -BH / 2 + r * CH + GAP_Y / 2;
          if (y < secYBot - 0.1 || y > secYTop + 0.1) continue;

          const sp  = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.1, GAP_Y, BD + 0.3), smat(fc, 0.2, 0.5));
          sp.position.set(0, y, 0); secGroup.add(sp);

          const ssp = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.1, GAP_Y, SD + 0.3), smat(df, 0.2, 0.5));
          ssp.position.set(SOX, y, SOZ); secGroup.add(ssp);

          // Right-face floor band
          const rfBand = new THREE.Mesh(new THREE.BoxGeometry(0.35, GAP_Y, BD + 0.1), smat(fc, 0.2, 0.5));
          rfBand.position.set(RF_DETAIL_X, y, 0); secGroup.add(rfBand);

          // Right-face ledge
          if (r % 3 === 0 && r > 0 && r < ROWS) {
            const rfLedge = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, BD + 0.5), smat(0xffe0a0, 0.25, 0.2));
            rfLedge.position.set(RF_LEDGE_X, y + GAP_Y / 2 + 0.08, 0);
            secGroup.add(rfLedge);

            // Posts along z
            for (let pi = -BD / 2 + 0.35; pi < BD / 2; pi += 0.58) {
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.05), smat(df, 0.2, 0.5));
              post.position.set(RF_RAIL_X, y + GAP_Y / 2 + 0.27, pi);
              secGroup.add(post);
            }

            // Horizontal rail
            const rfRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, BD + 0.5), smat(rc, 0.1, 0.7));
            rfRail.position.set(RF_RAIL_X, y + GAP_Y / 2 + 0.46, 0);
            secGroup.add(rfRail);
          }

          // Front-face ledges
          if (r % 3 === 0 && r > 0 && r < ROWS) {
            const ledge = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.5, 0.16, 0.8), smat(0xffe0a0, 0.25, 0.2));
            ledge.position.set(0, y + GAP_Y / 2 + 0.08, BD / 2 + 0.38); secGroup.add(ledge);
            for (let pi = -BW / 2 + 0.35; pi < BW / 2; pi += 0.58) {
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.05), smat(df, 0.2, 0.5));
              post.position.set(pi, y + GAP_Y / 2 + 0.27, BD / 2 + 0.75); secGroup.add(post);
            }
            const rl = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.5, 0.06, 0.06), smat(rc, 0.1, 0.7));
            rl.position.set(0, y + GAP_Y / 2 + 0.46, BD / 2 + 0.75); secGroup.add(rl);
          }
        }

        // Front-face mullions
        for (let c = 0; c <= COLS; c++) {
          const x  = -BW / 2 + c * CW + GAP_X / 2;
          const ml = new THREE.Mesh(new THREE.BoxGeometry(GAP_X, secH, BD + 0.3), smat(fc, 0.2, 0.5));
          ml.position.set(x, secYMid, 0); secGroup.add(ml);
        }
        for (let c = 0; c <= SCOLS; c++) {
          const z  = SOZ - SD / 2 + GAP_X / 2 + c * (SD / SCOLS);
          const ml = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.08, secH, GAP_X), smat(df, 0.2, 0.5));
          ml.position.set(SOX, secYMid, z); secGroup.add(ml);
        }

        // Right-face mullions
        const rfMullZs = [
          -BD / 2 + RF_OUTER_GAP * 0.5,
          0,
           BD / 2 - RF_OUTER_GAP * 0.5,
        ];
        rfMullZs.forEach(z => {
          const rfMull = new THREE.Mesh(new THREE.BoxGeometry(0.35, secH, RF_OUTER_GAP * 0.65), smat(fc, 0.2, 0.5));
          rfMull.position.set(RF_DETAIL_X, secYMid, z); secGroup.add(rfMull);
        });

        // Front-face windows
        for (let r = rowStart; r < rowEnd; r++) {
          for (let c = 0; c < COLS; c++) {
            const x = -BW / 2 + GAP_X + WIN_W / 2 + c * CW;
            const y = -BH / 2 + GAP_Y + WIN_H / 2 + r * CH;
            const z = BD / 2 + 0.06;

            if (Math.random() < 0.06) {
              const dm = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), smat(0xc8a060, 0.4, 0.1));
              dm.position.set(x, y, z); secGroup.add(dm);
            } else {
              const p  = palettes[Math.floor(Math.random() * palettes.length)];
              const ei = p.ei * (0.9 + Math.random() * 0.4);
              const wm = new THREE.MeshStandardMaterial({
                color: p.col, emissive: p.em, emissiveIntensity: ei,
                transparent: true, opacity: 0.78 + Math.random() * 0.18,
                roughness: 0.02, metalness: 0.15,
                polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
              });
              const wn = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), wm);
              wn.position.set(x, y, z); secGroup.add(wn);
              frontWins.push({ mesh: wn, base: ei, phase: Math.random() * Math.PI * 2, spd: 0.25 + Math.random() * 0.7 });

              for (let ps = 0; ps < 2 + Math.floor(Math.random() * 2); ps++) {
                const ox    = (Math.random() - 0.5) * WIN_W * 0.62;
                const baseY = y - WIN_H * 0.36;
                const sh    = WIN_H * (0.3 + Math.random() * 0.45);
                const stem  = new THREE.Mesh(new THREE.BoxGeometry(0.04, sh, 0.018), stMat);
                stem.position.set(x + ox, baseY + sh / 2, z + 0.04); secGroup.add(stem);
                for (let l = 0; l < 3; l++) {
                  const lw   = 0.17 + Math.random() * 0.2, lh = 0.12 + Math.random() * 0.15;
                  const leaf = new THREE.Mesh(leafGeo(lw, lh), mkLeafMat());
                  const sd2  = Math.random() > 0.5 ? 1 : -1;
                  leaf.rotation.z = sd2 * (0.3 + Math.random() * 0.4);
                  leaf.position.set(x + ox + sd2 * 0.09, baseY + sh * (0.2 + l * 0.28), z + 0.055);
                  secGroup.add(leaf);
                }
              }
            }
          }
        }

        // Right-face windows
        for (let r = rowStart; r < rowEnd; r++) {
          for (let c = 0; c < COLS_R; c++) {
            const y  = -BH / 2 + GAP_Y + WIN_H / 2 + r * CH;
            // c=0 left window, c=1 right window
            const zw = -BD / 2 + RF_OUTER_GAP + WIN_W / 2 + c * (WIN_W + RF_CENTER_GAP);

            const frameBacking = new THREE.Mesh(
              new THREE.BoxGeometry(0.08, WIN_H + 0.18, WIN_W + 0.18),
              smat(fc, 0.22, 0.3, true)
            );
            frameBacking.position.set(RF_WALL_X + 0.01, y, zw);
            secGroup.add(frameBacking);

            // Window sill
            const sill = new THREE.Mesh(
              new THREE.BoxGeometry(0.24, 0.07, WIN_W + 0.24),
              smat(0xffe8b0, 0.18, 0.18, true)
            );
            sill.position.set(RF_WIN_X + 0.07, y - WIN_H / 2 - 0.035, zw);
            secGroup.add(sill);

            // Window glass
            const wm = new THREE.MeshStandardMaterial({
              color: 0xfff8e8, emissive: 0xffdd88, emissiveIntensity: 0.95,
              transparent: true, opacity: 0.90,
              roughness: 0.02, metalness: 0.15,
              polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            });
            const wn = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), wm);
            wn.rotation.y = Math.PI / 2;
            wn.position.set(RF_WIN_X, y, zw);
            secGroup.add(wn);

            rentalWindows.push({
              mesh:        wn,
              row:         r,
              col:         c,
              origMat:     wm,
              rentalMat:   null,
              rentalIndex: r * COLS_R + c,
            });
          }
        }

        secGroup.visible    = false;
        secGroup.position.y = 3;
        buildingGroup.add(secGroup);
        floorSections.push({ group: secGroup, finalY: 0, topY: secYTop });
      }

      // Rooftop
      const rooftopGroup = new THREE.Group(); rooftopGroup.visible = false;
      const parapet  = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, 1.2, BD + 0.2), smat(0xffd8a0, 0.35, 0.1));
      parapet.position.set(0, BH / 2 + 0.6, 0); rooftopGroup.add(parapet);
      const sParapet = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.2, 1.2, SD + 0.2), smat(0xf5cc90, 0.35, 0.1));
      sParapet.position.set(SOX, BH / 2 + 0.6, SOZ); rooftopGroup.add(sParapet);
      const pent     = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.5, 2.8, BD * 0.75), smat(0xffe0b0, 0.35, 0.08));
      pent.position.set(BW * 0.08, BH / 2 + 1.2 + 1.4, 0); rooftopGroup.add(pent);
      for (let xi = -BW / 2 + 0.28; xi < BW / 2; xi += 0.58) {
        const rp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.72, 0.045), smat(df, 0.2, 0.5));
        rp.position.set(xi, BH / 2 + 1.56, BD / 2 + 0.01); rooftopGroup.add(rp);
      }
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, 0.06, 0.06), smat(rc, 0.1, 0.7));
      topRail.position.set(0, BH / 2 + 1.92, BD / 2 + 0.01); rooftopGroup.add(topRail);
      const wt    = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.8, 12), smat(0xffd090, 0.3, 0.15));
      wt.position.set(-BW / 2 + 1.2, BH / 2 + 1.2 + 1.5,   0); rooftopGroup.add(wt);
      const wtTop = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.7, 12), smat(fc, 0.2, 0.4));
      wtTop.position.set(-BW / 2 + 1.2, BH / 2 + 1.2 + 2.75, 0); rooftopGroup.add(wtTop);
      const ant   = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.8, 6), smat(df, 0.2, 0.6));
      ant.position.set(BW / 2 - 0.9, BH / 2 + 1.2 + 3.2, 0); rooftopGroup.add(ant);
      buildingGroup.add(rooftopGroup);

      // Podium + canopy
      const podium = new THREE.Mesh(new THREE.BoxGeometry(BW + SW + 0.6, 1.6, BD + 2.5), smat(0xf5c878, 0.5, 0.1));
      podium.position.set(-SW / 2 + 0.2, -BH / 2 - 0.8, 0.8); buildingGroup.add(podium);
      [-1.6, 1.6].forEach(px => {
        const cp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), smat(df, 0.2, 0.5));
        cp.position.set(px, -BH / 2 - 0.2, BD / 2 + 2.35); buildingGroup.add(cp);
      });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 2.5), smat(0xffd060, 0.15, 0.4));
      canopy.position.set(0, -BH / 2 + 0.5, BD / 2 + 1.2); buildingGroup.add(canopy);

      // Cranes
      const craneMat  = smat(0xffcc00, 0.4, 0.3);
      const cableMat  = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });
      const craneGroup = new THREE.Group(); buildingGroup.add(craneGroup);

      function makeCrane(x, z, height, armLen, phase) {
        const g = new THREE.Group(); g.userData.phase = phase;
        const mast   = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, 0.3), craneMat);
        mast.position.y = height / 2; g.add(mast);
        const jib    = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.2, 0.2), craneMat);
        jib.position.set(armLen * 0.2, height, 0); g.add(jib);
        const cJib   = new THREE.Mesh(new THREE.BoxGeometry(armLen * 0.4, 0.2, 0.2), craneMat);
        cJib.position.set(-armLen * 0.35, height, 0); g.add(cJib);
        const cw     = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), smat(0xcc9900, 0.5, 0.2));
        cw.position.set(-armLen * 0.5, height - 0.1, 0); g.add(cw);
        const tr     = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.25), smat(0xff4400, 0.4, 0.2));
        tr.position.set(armLen * 0.35, height + 0.12, 0); g.add(tr);
        const cH     = 3.5 + Math.random() * 2;
        const cab    = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, cH, 4), cableMat);
        cab.position.set(armLen * 0.35, height - cH / 2, 0); g.add(cab);
        const hook   = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), smat(0x444444, 0.6, 0.4));
        hook.position.set(armLen * 0.35, height - cH - 0.1, 0); g.add(hook);
        craneGroup.add(g); return g;
      }
      const cranes = [
        makeCrane(-BW * 0.3, BD * 0.2, 9,  8,   0.0),
        makeCrane( BW * 0.1, BD * 0.2, 11, 9,   1.2),
        makeCrane( BW * 0.35,BD * 0.2, 8,  7,   2.4),
        makeCrane(-BW * 0.05,BD * 0.2, 10, 8.5, 0.8),
      ];

      // Ground and park

      const trees       = [];
      const treePalette = [0x22bb44, 0x33cc55, 0x11aa33, 0x44dd55, 0x2ab84a, 0x55cc44];
      function makeTree(x, z, height, radius, phase) {
        const group  = new THREE.Group(); group.position.set(x, groundY, z);
        const trunkH = height * 0.38;
        const trunk  = new THREE.Mesh(new THREE.CylinderGeometry(radius*0.12, radius*0.18, trunkH, 7), new THREE.MeshStandardMaterial({ color:0x8B5E3C, roughness:0.9 }));
        trunk.position.y = trunkH / 2; group.add(trunk);
        const lc  = treePalette[Math.floor(Math.random() * treePalette.length)];
        const lm  = new THREE.MeshStandardMaterial({ color:lc, roughness:0.8, emissive:lc, emissiveIntensity:0.08 });
        for (let l = 0; l < 3; l++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(radius*(1.0-l*0.2), height*(0.45-l*0.04), 9), lm);
          cone.position.y = trunkH + l * height * 0.18; group.add(cone);
        }
        const top = new THREE.Mesh(new THREE.SphereGeometry(radius*0.55,8,6), new THREE.MeshStandardMaterial({ color:lc, roughness:0.8, emissive:lc, emissiveIntensity:0.1 }));
        top.position.y = trunkH + height * 0.52; group.add(top);
        scene.add(group);
        trees.push({ group, phase, speed: 0.4+Math.random()*0.3, amount: 0.018+Math.random()*0.012 });
      }
      makeTree(-18,2,6.5,2.8,0.0); makeTree(-22,5,5.5,2.4,0.8); makeTree(-15,6,7.0,3.0,1.4);
      makeTree(-20,-2,5.0,2.2,2.1); makeTree(-25,1,6.0,2.6,0.5); makeTree(14,2,6.0,2.6,1.2);
      makeTree(18,5,7.5,3.2,0.3);   makeTree(12,7,5.5,2.3,1.8);  makeTree(20,-1,6.5,2.8,2.5);
      makeTree(16,8,5.0,2.1,0.9);   makeTree(25,4,6.0,2.6,0.7);  makeTree(30,2,7.0,3.0,1.5);
      makeTree(35,6,5.5,2.4,2.0);   makeTree(32,-2,6.5,2.8,0.3); makeTree(38,3,5.8,2.5,1.1);
      makeTree(-10,12,4.5,2.0,1.1); makeTree(-4,14,5.0,2.2,0.4); makeTree(4,13,4.8,2.1,1.7);
      makeTree(10,12,5.2,2.3,2.2);  makeTree(18,12,5.0,2.2,0.8); makeTree(26,13,4.8,2.0,1.4);
      makeTree(-30,-5,8.0,3.5,0.6); makeTree(28,-3,8.5,3.8,1.3); makeTree(-5,-8,7.0,3.0,0.2);
      makeTree(8,-6,7.5,3.2,1.9);   makeTree(40,-4,8.0,3.5,0.9);

      const bushMat = new THREE.MeshStandardMaterial({ color:0x2abb44, roughness:0.85, emissive:0x1a8830, emissiveIntensity:0.1 });
      [[-12,8],[8,10],[-6,10],[12,8],[-16,4],[14,4],[-3,11],[6,11],[22,8],[28,10],[34,7]].forEach(([bx,bz]) => {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7+Math.random()*0.5,8,6), bushMat);
        bush.scale.y = 0.65; bush.position.set(bx, groundY+0.45, bz); scene.add(bush);
      });
      function bench(x, z, ry) {
        const g = new THREE.Group(); g.position.set(x,groundY,z); g.rotation.y = ry;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.1,0.5), smat(0x8B6914,0.8));
        seat.position.y = 0.65; g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.5,0.08), smat(0x8B6914,0.8));
        back.position.set(0,0.95,0.2); g.add(back);
        [-0.7,0.7].forEach(lx => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.65,0.5), smat(0x555555,0.7,0.3));
          leg.position.set(lx,0.32,0); g.add(leg);
        });
        scene.add(g);
      }
      bench(-8,9,0.3); bench(9,9,-0.3); bench(22,9,0.1);

      // Construction sequence
      const FLOOR_INTERVAL      = 0.3;
      const FLOOR_DROP_DURATION = 0.125;
      const CRANE_FADE_DURATION = 0.2;
      const sectionState = floorSections.map((_, i) => ({
        triggered: false, dropProgress: 0, landed: false, triggerTime: i * FLOOR_INTERVAL,
      }));
      let allLanded = false, craneFade = 1.0, readyFired = false, postLandElapsed = 0;
      let t = 0, lastTime = performance.now();

      function easeOutBack(x) {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      }
      function easeInOutCubic(x) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2; }

      // Scroll and camera state
      let scrollY       = 0;
      let targetScrollY = 0;
      let prevBrowse    = false;

      // Camera swoop
      let swoopActive    = false;
      let swoopT         = 0;
      const SWOOP_DUR    = 2.2;
      let swoopFrom      = { x: 0, y: 0, z: 0 };
     
      const LAND_LOOK_X  = 4,  LAND_LOOK_Y = 2,  LAND_LOOK_Z = 0;

      // Reverse swoop
      let revSwoopActive   = false;
      let revSwoopT        = 0;
      let revSwoopFrom     = { x: 0, y: 0, z: 0 };
      let revSwoopLookFrom = { x: 0, y: 0, z: 0 };

      // Page-turn animation
      const PT_DUR = 1.6;
      let ptPhase = 0; // 0=idle, 1=to front, 2=waiting, 3=to browse
      let ptT     = 0;
      let ptFrom  = { x: 0, y: 0, z: 0 };

      // Rental texture state
      const raycaster     = new THREE.Raycaster();
      const mouse         = new THREE.Vector2();
      let   hoveredWindow = null;
      let   texturesApplied = false;

      // Canvas texture
      function makeRentalTexture(rental) {
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 320;
        const ctx = cv.getContext('2d');

        // Background
        ctx.fillStyle = '#091510'; ctx.fillRect(0, 0, 256, 320);
        // Top accent
        ctx.fillStyle = '#44dd44'; ctx.fillRect(0, 0, 256, 6);
        // Bottom accent
        ctx.fillStyle = '#44dd44'; ctx.fillRect(0, 314, 256, 6);

        ctx.textAlign = 'center';

        // Price
        ctx.fillStyle = '#55ee33';
        ctx.font = 'bold 64px system-ui,sans-serif';
        ctx.fillText(`$${rental.rent}`, 128, 108);

        // /week
        ctx.fillStyle = '#77aa55';
        ctx.font = '22px system-ui,sans-serif';
        ctx.fillText('/ week', 128, 138);

        // Divider
        ctx.strokeStyle = '#1e4422'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(32, 162); ctx.lineTo(224, 162); ctx.stroke();

        // Suburb
        const sub = (rental.suburb || '').toUpperCase();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${sub.length > 10 ? 22 : 26}px system-ui,sans-serif`;
        ctx.fillText(sub.length > 13 ? sub.slice(0, 12) + '…' : sub, 128, 210);

        // State + postcode
        ctx.fillStyle = '#88aa88';
        ctx.font = '20px system-ui,sans-serif';
        ctx.fillText(`${rental.state || ''}  ${rental.postcode || ''}`, 128, 244);

        return new THREE.CanvasTexture(cv);
      }

      function applyRentalTextures() {
        const list = rentalsRef.current;
        rentalWindows.forEach(rw => {
          const rental = list[rw.rentalIndex];
          if (!rental) return;
          const tex = makeRentalTexture(rental);
          rw.rentalMat = new THREE.MeshStandardMaterial({
            map: tex, emissiveMap: tex,
            emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.5,
            transparent: true, opacity: 0.98,
            roughness: 0.02, metalness: 0.08,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
          });
          rw.mesh.material = rw.rentalMat;
        });
        texturesApplied = true;
      }

      function restoreOriginalTextures() {
        rentalWindows.forEach(rw => { rw.mesh.material = rw.origMat; });
        texturesApplied = false; hoveredWindow = null;
      }

      // Input handlers
      function onMouseMove(e) {
        if (!browseModeRef.current) return;
        const rect = mount.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      }
      function onClick(e) {
        if (!browseModeRef.current) return;
        const rect = mount.getBoundingClientRect();
        const cm   = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width)  * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(cm, camera);
        const hits = raycaster.intersectObjects(rentalWindows.map(rw => rw.mesh));
        if (hits.length > 0) {
          const rw = rentalWindows.find(w => w.mesh === hits[0].object);
          if (rw) {
            const rental = rentalsRef.current[rw.rentalIndex];
            if (rental && onSelectRef.current) onSelectRef.current(rental);
          }
        }
      }
      function onWheel(e) {
        if (!browseModeRef.current) return;
        targetScrollY = Math.max(MIN_SCROLL_Y, Math.min(getMaxScrollY(), targetScrollY + e.deltaY * 0.018));
      }
      mount.addEventListener('mousemove', onMouseMove);
      mount.addEventListener('click',     onClick);
      mount.addEventListener('wheel',     onWheel, { passive: true });

      // Animation loop
      function lerp(a, b, k) { return a + (b - a) * k; }

      function animate() {
        animId = requestAnimationFrame(animate);
        const now   = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now; t += delta;

        // Construction
        if (!allLanded) {
          sectionState.forEach((state, i) => {
            const sec = floorSections[i];
            if (!state.triggered && t >= state.triggerTime) { state.triggered = true; sec.group.visible = true; sec.group.position.y = 1.5; }
            if (state.triggered && !state.landed) {
              state.dropProgress = Math.min(state.dropProgress + delta / FLOOR_DROP_DURATION, 1.0);
              sec.group.position.y = 3 * (1 - easeOutBack(state.dropProgress));
              if (state.dropProgress >= 1.0) { state.landed = true; sec.group.position.y = 0; }
            }
          });
          const lc = sectionState.filter(s => s.landed).length;
          if (lc > 0) craneGroup.position.y = floorSections[lc - 1].topY;
          if (sectionState.every(s => s.landed)) { allLanded = true; rooftopGroup.visible = true; }
        } else {
          postLandElapsed += delta;
          if (postLandElapsed > 0.3) {
            craneFade = Math.max(0, craneFade - delta / CRANE_FADE_DURATION);
            craneGroup.traverse(ch => {
              if (ch.isMesh && ch.material) { if (!ch.material.transparent) ch.material.transparent = true; ch.material.opacity = craneFade; }
            });
            if (craneFade <= 0) { craneGroup.visible = false; if (!readyFired) { readyFired = true; if (onReady) onReady(); } }
          }
        }
        if (!readyFired) cranes.forEach(c => { c.rotation.y = Math.sin(t * 0.9 + c.userData.phase) * 0.05; });

        // Detect mode transitions
        const nowBrowse = browseModeRef.current;
        if (nowBrowse && !prevBrowse) {
          // Landing to browse
          targetScrollY      = INITIAL_SCROLL_Y;
          scrollY            = INITIAL_SCROLL_Y;
          swoopFrom          = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
          swoopActive        = true;
          swoopT             = 0;
          revSwoopActive     = false;
        }
        if (!nowBrowse && prevBrowse) {
          // Browse to landing
          revSwoopFrom       = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
          revSwoopLookFrom   = { x: BROWSE_LOOK_X, y: camera.position.y, z: BROWSE_CAM_Z };
          revSwoopActive     = true;
          revSwoopT          = 0;
          swoopActive        = false;
        }
        prevBrowse = nowBrowse;

        // Apply or remove rental textures
        if (retextureRef.current && texturesApplied && ptPhase === 0) {
          restoreOriginalTextures();
          retextureRef.current = false;
        }
        if (nowBrowse  && !texturesApplied && rentalsRef.current.length > 0) applyRentalTextures();
        if (!nowBrowse && texturesApplied)  restoreOriginalTextures();

        // Clamp and smooth scroll
        if (nowBrowse) targetScrollY = Math.max(MIN_SCROLL_Y, Math.min(getMaxScrollY(), targetScrollY));
        scrollY = lerp(scrollY, targetScrollY, delta * 5);

        // Camera
        if (nowBrowse) {
          // Page-turn: start swing to front
          if (pageTurnRef && pageTurnRef.current) {
            ptPhase = 1;
            ptT     = 0;
            ptFrom  = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
            pageTurnRef.current = false;
            swoopActive = false;
            retextureRef.current = false; // Suppress auto-retexture during animation
          }

          if (ptPhase === 1) {
            // Swing from side to front
            ptT += delta;
            const p = Math.min(ptT / PT_DUR, 1.0);
            const e = easeInOutCubic(p);
            camera.position.x = ptFrom.x + (4  - ptFrom.x) * e;
            camera.position.z = ptFrom.z + (55 - ptFrom.z) * e;
            camera.position.y = lerp(camera.position.y, scrollY, delta * 3);
            const lx = BROWSE_LOOK_X + (LAND_LOOK_X - BROWSE_LOOK_X) * e;
            const lz = BROWSE_CAM_Z  + (0           - BROWSE_CAM_Z)  * e;
            camera.lookAt(lx, camera.position.y, lz);
            if (p >= 1.0) {
              // Swap textures while facing front
              if (texturesApplied) restoreOriginalTextures();
              ptPhase = pageTurnReadyRef && pageTurnReadyRef.current ? 3 : 2;
              if (pageTurnReadyRef) pageTurnReadyRef.current = false;
              ptT    = 0;
              ptFrom = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
            }
          } else if (ptPhase === 2) {
            // Hold at front until data is ready
            camera.position.x = 4;
            camera.position.z = 55;
            camera.lookAt(LAND_LOOK_X, camera.position.y, 0);
            if (pageTurnReadyRef && pageTurnReadyRef.current) {
              pageTurnReadyRef.current = false;
              ptPhase = 3;
              ptT     = 0;
              ptFrom  = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
            }
          } else if (ptPhase === 3) {
            // Swing from front to side with new listings
            ptT += delta;
            const p = Math.min(ptT / PT_DUR, 1.0);
            const e = easeInOutCubic(p);
            camera.position.x = ptFrom.x + (BROWSE_CAM_X - ptFrom.x) * e;
            camera.position.z = ptFrom.z + (BROWSE_CAM_Z - ptFrom.z) * e;
            camera.position.y = lerp(camera.position.y, scrollY, delta * 5);
            const lx = LAND_LOOK_X + (BROWSE_LOOK_X - LAND_LOOK_X) * e;
            const lz = 0           + (BROWSE_CAM_Z  - 0)           * e;
            camera.lookAt(lx, camera.position.y, lz);
            if (p >= 1.0) ptPhase = 0;
          } else if (swoopActive) {
            // Initial entry swoop
            swoopT += delta;
            const p = Math.min(swoopT / SWOOP_DUR, 1.0);
            const e = easeInOutCubic(p);
            camera.position.x = swoopFrom.x + (BROWSE_CAM_X - swoopFrom.x) * e;
            camera.position.y = swoopFrom.y + (scrollY       - swoopFrom.y) * e;
            camera.position.z = swoopFrom.z + (BROWSE_CAM_Z  - swoopFrom.z) * e;
            const lx = LAND_LOOK_X + (BROWSE_LOOK_X - LAND_LOOK_X) * e;
            const ly = LAND_LOOK_Y + (camera.position.y - LAND_LOOK_Y) * e;
            const lz = LAND_LOOK_Z + (BROWSE_CAM_Z    - LAND_LOOK_Z) * e;
            camera.lookAt(lx, ly, lz);
            if (p >= 1.0) swoopActive = false;
          } else {
            // Follow scroll after swoop
            camera.position.x = BROWSE_CAM_X;
            camera.position.z = BROWSE_CAM_Z;
            camera.position.y = lerp(camera.position.y, scrollY, delta * 5);
            camera.lookAt(BROWSE_LOOK_X, camera.position.y, camera.position.z);
          }
        } else {
          if (revSwoopActive) {
            // Reverse swoop to landing position
            revSwoopT += delta;
            const p = Math.min(revSwoopT / SWOOP_DUR, 1.0);
            const e = easeInOutCubic(p);
            camera.position.x = revSwoopFrom.x + (4  - revSwoopFrom.x) * e;
            camera.position.y = revSwoopFrom.y + (3  - revSwoopFrom.y) * e;
            camera.position.z = revSwoopFrom.z + (55 - revSwoopFrom.z) * e;
            // Sweep look-at from side to front
            const lx = revSwoopLookFrom.x + (LAND_LOOK_X - revSwoopLookFrom.x) * e;
            const ly = revSwoopLookFrom.y + (LAND_LOOK_Y - revSwoopLookFrom.y) * e;
            const lz = revSwoopLookFrom.z + (LAND_LOOK_Z - revSwoopLookFrom.z) * e;
            camera.lookAt(lx, ly, lz);
            if (p >= 1.0) revSwoopActive = false;
          } else {
            // Idle drift
            camera.position.x = lerp(camera.position.x, 4 + Math.sin(t * 0.04) * 0.5, delta * 1.5);
            camera.position.y = lerp(camera.position.y, 3 + Math.sin(t * 0.06) * 0.3,  delta * 1.5);
            camera.position.z = lerp(camera.position.z, 55, delta * 1.5);
            camera.lookAt(LAND_LOOK_X, LAND_LOOK_Y, LAND_LOOK_Z);
          }
          targetScrollY = INITIAL_SCROLL_Y;
        }

        // Hover highlight
        if (nowBrowse && texturesApplied) {
          raycaster.setFromCamera(mouse, camera);
          const hittable = rentalWindows.filter(rw => rw.rentalMat).map(rw => rw.mesh);
          const hits     = raycaster.intersectObjects(hittable);
          const newHover = hits.length > 0 ? rentalWindows.find(rw => rw.mesh === hits[0].object) : null;
          if (newHover !== hoveredWindow) {
            if (hoveredWindow?.rentalMat) { hoveredWindow.rentalMat.emissiveIntensity = 1.5; hoveredWindow.mesh.scale.set(1, 1, 1); }
            if (newHover?.rentalMat)      { newHover.rentalMat.emissiveIntensity = 2.4; newHover.mesh.scale.set(1.07, 1.07, 1); mount.style.cursor = 'pointer'; }
            else                          { mount.style.cursor = ''; }
            hoveredWindow = newHover;
          }
        }

        // Tree sway
        trees.forEach(tr => {
          tr.group.rotation.z = Math.sin(t * tr.speed + tr.phase)           * tr.amount;
          tr.group.rotation.x = Math.sin(t * tr.speed * 0.7 + tr.phase + 1) * tr.amount * 0.4;
        });

        // Window flicker
        if (!nowBrowse) {
          frontWins.forEach(w => { w.mesh.material.emissiveIntensity = Math.max(0.1, w.base + Math.sin(t * w.spd + w.phase) * 0.15); });
        }

        renderer.render(scene, camera);
      }
      animate();
    }

    if (window.THREE) { init(window.THREE); }
    else {
      const script = document.createElement('script');
      script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = () => init(window.THREE);
      document.head.appendChild(script);
    }

    return () => {
      cancelAnimationFrame(animId);
      if (renderer && mount) { mount.removeChild(renderer.domElement); renderer.dispose(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: Three.js scene must initialise once only; refs are read inside the closure

  return <div ref={mountRef} style={{ width: '100%', height: '100%', ...style }} />;
}
