<template>
  <div class="shader-panel">
    <h3>3D 模型特效控制</h3>
    <div class="btn-group">
      <button 
        :class="{ active: currentEffect === 'scan' }" 
        @click="changeEffect('scan')"
      >
        ⚡ 动态扫描
      </button>
      <button 
        :class="{ active: currentEffect === 'radar' }" 
        @click="changeEffect('radar')"
      >
        📡 雷达放射
      </button>
      <button 
        :class="{ active: currentEffect === 'tech' }" 
        @click="changeEffect('tech')"
      >
        🕸️ 科技网格
      </button>
      <button 
        :class="{ active: currentEffect === 'rain' }" 
        @click="changeEffect('rain')"
      >
        🌧️ 下雨模拟
      </button>

      <button 
        class="reset-btn"
        :class="{ active: currentEffect === 'none' }" 
        @click="changeEffect('none')"
      >
        🚫 恢复默认
      </button>
    </div>
    <div class="status-tips">
      当前状态: {{ effectNameMap[currentEffect] }}
    </div>
  </div>
</template>

<script setup>
import { defineProps, shallowRef, watch } from 'vue';
import { useCustomShader } from './hooks/useCustomShader.js';

const props = defineProps({
  viewer: { type: Object, required: true },
  tileset: { type: Object, default: null }
});

const viewerRef = shallowRef(props.viewer);
const tilesetRef = shallowRef(props.tileset);

watch(() => props.tileset, (newVal) => {
  if (newVal) tilesetRef.value = newVal;
});

const { currentEffect, applyShader } = useCustomShader(viewerRef, tilesetRef);

// 修改处：增加 'radar' 的状态描述
const effectNameMap = {
  'none': '原始模型',
  'scan': '城市数据扫描中...',
  'radar': '区域雷达监测波放射中', 
  'tech': '赛博朋克线框模式',
  'rain': '雨天湿滑路面分析'
};

const changeEffect = (type) => {
  if (!props.tileset) {
    alert("模型尚未加载完成，请稍候");
    return;
  }
  applyShader(type);
};
</script>

<style scoped>

.shader-panel {
  position: absolute;
  top: 120px;
  right: 50px;
  width: 200px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 8px;
  color: white;
  z-index: 999;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.shader-panel {
  position: absolute;
  top: 120px;
  right: 50px;
  width: 200px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 8px;
  color: white;
  z-index: 999;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

h3 {
  margin-top: 0;
  font-size: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s;
  text-align: left;
}

button:hover {
  background: rgba(255, 255, 255, 0.2);
}

button.active {
  background: #409eff;
  border-color: #409eff;
  font-weight: bold;
}

button.reset-btn.active {
  background: #666;
  border-color: #666;
}

.status-tips {
  margin-top: 15px;
  font-size: 12px;
  color: #aaa;
  text-align: center;
}
</style>