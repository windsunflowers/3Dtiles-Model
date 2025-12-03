import * as Cesium from 'cesium';
import { ref, onUnmounted } from 'vue';

export function useCustomShader(viewerRef, tilesetRef) {
  const currentEffect = ref('none'); 
  let removeListener = null; 
  const startTime = performance.now();

  const startAnimationLoop = () => {
    const viewer = viewerRef.value || viewerRef;
    const tileset = tilesetRef.value || tilesetRef;
    if (!viewer || !tileset) return;

    if (removeListener) {
      removeListener();
      removeListener = null;
    }

    removeListener = viewer.scene.postUpdate.addEventListener(() => {
      const shader = tileset.customShader;
      if (shader && shader.uniforms && shader.uniforms.u_time) {
        const elapsedTime = (performance.now() - startTime) / 1000.0;
        shader.setUniform('u_time', elapsedTime);
      }
    });
  };

  const applyShader = (type) => {
    const tileset = tilesetRef.value || tilesetRef;
    const viewer = viewerRef.value || viewerRef;

    if (!tileset) {
      console.warn("Tileset 尚未加载完成");
      return;
    }

    // 1. 强制更新，确保能获取到模型中心
    if (!tileset.boundingSphere) {
       tileset.update(tileset._frameState || viewer.scene.frameState); 
       if(!tileset.boundingSphere) {
         console.error("模型未就绪，无法计算中心点");
         return;
       }
    }

    currentEffect.value = type;

    // --- A: 移除特效 ---
    if (type === 'none') {
      tileset.customShader = undefined;
      if (removeListener) {
        removeListener();
        removeListener = null;
      }
      return;
    }

    // --- 准备矩阵 (用于雷达和扫描的中心定位) ---
    const center = tileset.boundingSphere.center;
    const radius = tileset.boundingSphere.radius;
    const centerFrame = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const invMatrix = Cesium.Matrix4.inverse(centerFrame, new Cesium.Matrix4());

    let fragmentShaderText = '';
    let uniforms = {
        u_time: { type: Cesium.UniformType.FLOAT, value: 0 },
    };
    
    // ★★★ 核心修复：默认为 UNLIT (无光照) ★★★
    // 这样 Cesium 就不会尝试计算光影，从而避免黑底，直接显示最真实的贴图。
    let lightingModel = Cesium.LightingModel.UNLIT;
    let translucencyMode = Cesium.CustomShaderTranslucencyMode.OPAQUE;

    // =========================================================
    // 1. [保持不变] 科技网格 (Tech)
    // 这个模式需要特殊处理，因为它原本设计就是改变背景的
    // =========================================================
    if (type === 'tech') {
      lightingModel = Cesium.LightingModel.PBR; // Tech模式保持 PBR
      translucencyMode = Cesium.CustomShaderTranslucencyMode.TRANSLUCENT; 
      fragmentShaderText = `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            vec3 positionMC = fsInput.attributes.positionMC;
            float spacing = 30.0; 
            vec3 grid = abs(fract(positionMC / spacing) - 0.5);
            float lineWeight = 0.05; 
            float line = step(0.5 - lineWeight, max(grid.x, max(grid.y, grid.z)));
            if (line > 0.0) {
                material.diffuse = vec3(0.0, 1.0, 0.2); 
                material.emissive = vec3(0.0, 1.0, 0.2);
                material.alpha = 1.0;
            } else {
                material.diffuse = vec3(0.0, 0.1, 0.1);
                material.alpha = 0.3; 
            }
        }
      `;
    } 

    // =========================================================
    // 2. [绝对无黑底] 下雨 (Rain) - UNLIT 模式
    // =========================================================
    else if (type === 'rain') {
      fragmentShaderText = `
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            vec3 positionMC = fsInput.attributes.positionMC;

            // 在 UNLIT 模式下，material.diffuse 就是最终输出的颜色 (纹理原色)
            // 我们不做任何乘法，保证亮度 100%

            // 计算雨痕位置
            float time = u_time * 4.0;
            float yDrop = positionMC.z * 0.2 + time;
            vec2 noiseUV = vec2(positionMC.x * 0.02, yDrop); 
            float rawNoise = hash(floor(noiseUV * 2.0)); 
            
            // 极度稀疏
            float rainLine = step(0.82, rawNoise); 

            // 雨痕颜色
            vec3 rainColor = vec3(0.7, 0.8, 1.0);
            
            // 直接把雨痕颜色“加”到原本的纹理颜色上
            if (rainLine > 0.1) {
                material.diffuse += rainColor * 0.4;
            }
        }
      `;
      startAnimationLoop();
    }

    // =========================================================
    // 3. [绝对无黑底] 雷达 (Radar) - UNLIT 模式
    // =========================================================
    else if (type === 'radar') {
      uniforms.u_centerMatrix = { type: Cesium.UniformType.MAT4, value: invMatrix };
      uniforms.u_scanColor = { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(0.0, 1.0, 1.0) }; // 青色
      uniforms.u_radius = { type: Cesium.UniformType.FLOAT, value: radius };

      fragmentShaderText = `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            // UNLIT 模式：material.diffuse 是原图颜色，不计算光照，绝对不黑
            
            vec3 positionWC = fsInput.attributes.positionWC;
            vec4 localPos = u_centerMatrix * vec4(positionWC, 1.0);
            float dist = length(localPos.xy);
            float maxR = u_radius * 0.9; 

            // 扩散动画
            float duration = 4.0;
            float progress = fract(u_time / duration);
            float currentR = maxR * progress;

            // 光圈计算
            float width = maxR * 0.03; 
            float ring = smoothstep(currentR - width, currentR, dist) * smoothstep(currentR + width, currentR, dist);

            // 叠加发光：直接加到 diffuse 上
            if (ring > 0.01) {
                material.diffuse += u_scanColor * ring * 1.5;
            }
        }
      `;
      startAnimationLoop();
    }

    // =========================================================
    // 4. [绝对无黑底] 高度扫描 (Scan) - UNLIT 模式
    // =========================================================
    else if (type === 'scan') {
      uniforms.u_centerMatrix = { type: Cesium.UniformType.MAT4, value: invMatrix };
      uniforms.u_radius = { type: Cesium.UniformType.FLOAT, value: radius };
      uniforms.u_scanColor = { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(0.0, 1.0, 1.0) }; 

      fragmentShaderText = `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            // UNLIT 模式：material.diffuse 是原图颜色
        
            vec3 positionWC = fsInput.attributes.positionWC;
            vec4 localPos = u_centerMatrix * vec4(positionWC, 1.0);

            // 高度映射
            float top = u_radius * 0.5; 
            float bottom = -u_radius * 0.2;
            float h = (localPos.z - bottom) / (top - bottom);
            
            // 倒序：从高到低
            float scanTime = 1.0 - fract(u_time * 0.4); 
            
            float width = 0.05;
            float line = smoothstep(scanTime, scanTime + width, h) * smoothstep(scanTime + width * 4.0, scanTime, h);

            // 叠加发光
            if (line > 0.01) {
                material.diffuse += u_scanColor * line * 1.5;
            }
        }
      `;
      startAnimationLoop();
    }

    tileset.customShader = new Cesium.CustomShader({
      lightingModel,
      translucencyMode,
      uniforms,
      fragmentShaderText
    });
  };

  onUnmounted(() => {
    if (removeListener) {
      removeListener();
    }
  });

  return {
    currentEffect,
    applyShader
  };
}