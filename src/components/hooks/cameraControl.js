import { ref, reactive, onUnmounted } from 'vue';
import * as Cesium from 'cesium';

export default function useCameraControl() {
  let viewer = null;
  let rotateListener = null; // 自动旋转的事件监听器
  
  // 状态数据
  const status = reactive({
    heading: 0, // 水平角度 (0-360)
    pitch: -45, // 俯仰角度 (-90 ~ 0)
    range: 1000, // 距离
    isAutoRotating: false
  });

  // 锁定目标矩阵 (用于 lookAtTransform)
  let centerTransform = null;

  /**
   * 初始化
   * @param {Cesium.Viewer} v 
   */
  const initCameraControl = (v) => {
    viewer = v;
  };

  /**
   * 锁定当前视野中心作为观察目标
   * (在模型加载完成后调用此方法，或者点击“锁定目标”按钮)
   */
  const lockTarget = () => {
    if (!viewer) return;

    // 1. 获取屏幕中心对应的笛卡尔坐标
    const canvas = viewer.scene.canvas;
    const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    
    // 尝试拾取模型或地形上的点
    let position = viewer.scene.pickPosition(center);
    
    if (!position) {
      // 如果没拾取到，尝试用地球椭球体表面
      position = viewer.camera.pickEllipsoid(center);
    }

    if (position) {
      // 2. 创建基于该点的局部坐标系矩阵
      centerTransform = Cesium.Transforms.eastNorthUpToFixedFrame(position);
      
      // 3. 获取当前相机的 heading/pitch/range
      const currentHPR = new Cesium.HeadingPitchRange(
        viewer.camera.heading,
        viewer.camera.pitch,
        Cesium.Cartesian3.distance(position, viewer.camera.position)
      );

      // 同步状态
      status.heading = Cesium.Math.toDegrees(currentHPR.heading);
      status.pitch = Cesium.Math.toDegrees(currentHPR.pitch);
      status.range = currentHPR.range;

      // 4. 锁定相机 (使用 lookAtTransform)
      updateCamera();
      console.log('已锁定观察目标中心');
    }
  };

  /**
   * 解除锁定 (恢复自由视角)
   */
  const unlockTarget = () => {
    if (viewer) {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      centerTransform = null;
      stopAutoRotate();
    }
  };

  /**
   * 更新相机位置 (核心逻辑)
   */
  const updateCamera = () => {
    if (!viewer || !centerTransform) return;

    const offset = new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(status.heading),
      Cesium.Math.toRadians(status.pitch),
      status.range
    );

    // 核心：始终看向 centerTransform 定义的中心点
    viewer.camera.lookAtTransform(centerTransform, offset);
  };

  // --- 交互控制 ---

  const setHeading = (val) => {
    status.heading = val;
    updateCamera();
  };

  const setPitch = (val) => {
    status.pitch = val;
    updateCamera();
  };

  const setRange = (val) => {
    status.range = val;
    updateCamera();
  };

  // --- 自动旋转 ---
  
  const startAutoRotate = () => {
    if (!viewer || status.isAutoRotating) return;
    
    // 如果没锁定目标，先锁定
    if (!centerTransform) lockTarget();

    status.isAutoRotating = true;
    
    // 添加帧监听器
    rotateListener = viewer.clock.onTick.addEventListener(() => {
      status.heading += 0.2; // 旋转速度
      if (status.heading > 360) status.heading = 0;
      updateCamera();
    });
  };

  const stopAutoRotate = () => {
    if (rotateListener) {
      rotateListener(); // 移除监听器
      rotateListener = null;
    }
    status.isAutoRotating = false;
  };

  const toggleAutoRotate = () => {
    if (status.isAutoRotating) stopAutoRotate();
    else startAutoRotate();
  };

  onUnmounted(() => {
    unlockTarget();
  });

  return {
    status,
    initCameraControl,
    lockTarget,
    unlockTarget,
    setHeading,
    setPitch,
    setRange,
    toggleAutoRotate
  };
}