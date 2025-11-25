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
    if (!tileset) {
      console.warn("Tileset 尚未加载完成");
      return;
    }
    
    // 确保模型包围球已准备好，否则无法计算中心
    if (!tileset.boundingSphere) {
       console.warn("模型包围球未就绪，无法计算中心");
       return;
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

    let fragmentShaderText = '';
    let uniforms = {};
    let lightingModel = Cesium.LightingModel.PBR;
    let translucencyMode = Cesium.CustomShaderTranslucencyMode.OPAQUE;

    // --- B: 动态扫描线 ---
    if (type === 'scan') {
      uniforms = {
        u_time: { type: Cesium.UniformType.FLOAT, value: 0 },
        u_color: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(0.0, 1.0, 1.0) } 
      };
      fragmentShaderText = `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            vec3 positionMC = fsInput.attributes.positionMC;
            float scanLine = mod(positionMC.z - u_time * 50.0, 200.0);
            float intensity = 1.0 - smoothstep(0.0, 10.0, abs(scanLine));
            material.diffuse *= 0.3;
            if (intensity > 0.0) {
                material.emissive = u_color * intensity * 5.0;
                material.diffuse = mix(material.diffuse, u_color, intensity);
            }
        }
      `;
      startAnimationLoop();
    } 
    
    // --- E: 唯一的全局中心雷达 (Global Radar) ---
    // ★★★ 核心修复：使用矩阵解决多中心问题 ★★★
    else if (type === 'radar') {
      
      // 1. 计算整个 Tileset 的绝对中心
      const center = tileset.boundingSphere.center;
      
      // 2. 创建一个“以中心为原点，东北上为轴”的局部坐标系矩阵
      const centerFrame = Cesium.Transforms.eastNorthUpToFixedFrame(center);
      
      // 3. 求逆矩阵：我们需要把世界坐标(WC) 转换回 这个局部坐标系
      const invMatrix = Cesium.Matrix4.inverse(centerFrame, new Cesium.Matrix4());

      uniforms = {
        u_time: { type: Cesium.UniformType.FLOAT, value: 0 },
        // 传入这个矩阵，让 shader 知道哪里是真正的“正中心”
        u_centerMatrix: { type: Cesium.UniformType.MAT4, value: invMatrix }
      };

      fragmentShaderText = `
        #define PI 3.14159265
        
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            // ★★★ 关键点：不再用 positionMC，改用 positionWC ★★★
            vec3 positionWC = fsInput.attributes.positionWC;
            
            // 利用矩阵，把当前像素的世界坐标，转换成相对于模型中心的坐标
            // 转换后：(0,0,0) 就是模型正中心，z是高度，xy是平面
            vec4 localPos = u_centerMatrix * vec4(positionWC, 1.0);
            
            // --- 下面是雷达逻辑 (完全沿用之前代码，只是把 positionMC 换成了 localPos) ---
            
            // 1. 参数设置
            float maxRadius = 350.0;     // 半径 (米)
            vec3 radarColor = vec3(1.0, 0.8, 0.0); 
            float speed = 1.5;            
            
            // 2. 坐标计算 (使用 localPos.xy)
            float dist = length(localPos.xy); 
            float angle = atan(localPos.y, localPos.x);
            float angle01 = angle / (2.0 * PI) + 0.5; 

            // 3. 扫描束
            float timeProgress = fract(-u_time * speed * 0.2); 
            float diff = timeProgress - angle01;
            if (diff < 0.0) diff += 1.0;
            float beam = pow(1.0 - diff, 12.0);

            // 4. 网格线
            float gridRing = 1.0 - step(3.0, mod(dist, 200.0)); 
            // 十字线 (使用 localPos)
            float crossHair = step(abs(localPos.x), 2.0) + step(abs(localPos.y), 2.0); 
            float grid = max(gridRing, crossHair) * 0.3; 

            // 5. 范围裁切
            if (dist > maxRadius) {
                beam = 0.0;
                grid = 0.0;
            } else {
                 float edgeFade = 1.0 - smoothstep(maxRadius * 0.95, maxRadius, dist);
                 beam *= edgeFade;
                 grid *= edgeFade;
            }

            // 6. 上色
            float totalIntensity = clamp(beam + grid, 0.0, 1.0);
            if (totalIntensity > 0.01) {
                material.diffuse *= 0.2; 
                material.diffuse = mix(material.diffuse, radarColor, totalIntensity);
                material.emissive = radarColor * beam * 5.0 + radarColor * grid * 2.0;
            }
        }
      `;
      startAnimationLoop(); 
    }

    // --- C: 科技网格 ---
    else if (type === 'tech') {
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
    
    // --- D: 下雨模拟 ---
    else if (type === 'rain') {
      uniforms = { u_time: { type: Cesium.UniformType.FLOAT, value: 0 } };
      fragmentShaderText = `
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p) {
           vec2 i = floor(p); vec2 f = fract(p);
           float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
           float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
           vec2 u = f * f * (3.0 - 2.0 * f);
           return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            vec3 positionMC = fsInput.attributes.positionMC;
            material.diffuse *= 0.6;
            material.specular = vec3(0.8); 
            material.roughness = 0.1; 
            float time = u_time * 8.0;
            vec2 rippleUV = positionMC.xy * 2.0; 
            float rippleNoise = hash(floor(rippleUV));
            float ripple = smoothstep(0.9, 1.0, sin(time * 0.5 + rippleNoise * 6.28));
            vec2 wallUV = vec2(positionMC.x + positionMC.y, positionMC.z * 0.5 + time * 2.0);
            float wallNoise = noise(wallUV * 10.0); 
            float streak = smoothstep(0.4, 0.6, wallNoise); 
            float rainEffect = ripple * 0.5 + streak * 0.3;
            material.diffuse = mix(material.diffuse, vec3(0.7, 0.8, 1.0), rainEffect);
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