<template>
  <div v-if="properties" class="property-panel" :style="positionStyle">
    <div class="header">
      <span>📝 属性详情</span>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="content">
      <div v-for="(value, key) in properties" :key="key" class="row">
        <span class="key">{{ key }}:</span>
        <span class="value">{{ value }}</span>
      </div>
      <div v-if="Object.keys(properties).length === 0" class="empty">
        暂无属性数据
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  properties: Object,
  position: Object // {x, y}
});

defineEmits(['close']);

// 计算弹窗位置，稍微偏移一点以免遮挡鼠标
const positionStyle = computed(() => {
  if (!props.position) return {};
  // 限制一下，不要跑出屏幕右下角 (简单处理)
  const left = Math.min(props.position.x + 20, window.innerWidth - 320);
  const top = Math.min(props.position.y + 20, window.innerHeight - 400);
  return {
    left: `${left}px`,
    top: `${top}px`
  };
});
</script>

<style scoped>
.property-panel {
  position: absolute;
  width: 300px;
  max-height: 400px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  z-index: 3000; /* 确保在最上层 */
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  font-size: 13px;
}

.header {
  padding: 10px 15px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.05);
  font-weight: bold;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 18px;
}
.close-btn:hover { color: #fff; }

.content {
  padding: 10px;
  overflow-y: auto;
  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #555 transparent;
}

.row {
  display: flex;
  border-bottom: 1px dashed rgba(255,255,255,0.1);
  padding: 6px 0;
}
.row:last-child { border-bottom: none; }

.key {
  color: #94a3b8;
  width: 100px;
  flex-shrink: 0;
  word-break: break-all;
}

.value {
  color: #e2e8f0;
  flex: 1;
  word-break: break-all;
}
.empty { text-align: center; color: #666; padding: 20px; }
</style>