import { computed, ref } from 'vue'
import * as Cesium from 'cesium'

export default () => {
  // 存储 Cesium viewer 实例
  let viewer = null

  // 响应式变量，表示当前是否为城市视角
  const isCityView = ref(false)

  // 计算属性，返回当前视角的提示信息
  const flyMsg = computed(() => {
    return isCityView.value ? '俯视视角' : '模型视角'
  })

  // 设置 viewer 实例的函数
  function setViewer(viewerInstance) {
    viewer = viewerInstance
    console.log('Fly hook: Viewer 实例已设置', viewer)
  }

  // 视角切换函数
  function flyTo() {
    console.log('flyTo 函数被调用，当前 viewer:', viewer)
    console.log('当前 isCityView:', isCityView.value)
    
    if (!viewer) {
      console.error('Cesium viewer 未初始化，无法切换视角')
      return
    }

    try {
      // 切换视角状态
      isCityView.value = !isCityView.value

      if (isCityView.value) {
        // 俯视城市视角 - 武汉坐标
        console.log('切换到城市视角')
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(114.3, 30.58, 50000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          },
          duration: 2
        })
      } else {
        // 模型视角
        console.log('切换到模型视角')
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(114.535263,30.493814,1000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          },
          duration: 2
        })
      }
    } catch (error) {
      console.error('切换视角时出错:', error)
    }
  }

  return {
    flyMsg,
    flyTo,
    isCityView,
    setViewer
  }
}