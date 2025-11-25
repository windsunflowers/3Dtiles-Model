<template>
  <div class="toolbar">
    <!-- 1. 模型管理 -->
    <div 
      class="tool-item" 
      :class="{ active: activePanel === 'model' }" 
      @click="$emit('toggle', 'model')"
    >
        <span class="icon">🏗️</span>
        <span class="label">模型管理</span>
    </div>

    <!-- 2. 特效分析 (新增) -->
    <div 
      class="tool-item" 
      :class="{ active: activePanel === 'shader' }" 
      @click="$emit('toggle', 'shader')"
    >
        <span class="icon">🎨</span>
        <span class="label">特效分析</span>
    </div>
    
    <!-- 3. 快捷视角 -->
    <div 
      class="tool-item" 
      :class="{ active: activePanel === 'control' }" 
      @click="$emit('toggle', 'control')"
    >
      <span class="icon">🗺️</span>
      <span class="label">快捷视角</span>
    </div>

    <!-- 4. 视角切换 -->
    <div 
      class="tool-item" 
      :class="{ active: activePanel === 'camera' }" 
      @click="$emit('toggle', 'camera')"
      title="全方位观察"
    >
      <span class="icon">📷</span>
      <span class="label">视角切换</span>
    </div>

    <!-- 5. 地形图切换 -->
    <div 
      class="tool-item" 
      :class="{ active: hasTerrain }" 
      @click="$emit('toggleTerrain')"
    >
      <span class="icon">⛰️</span>
      <span class="label">地形图切换</span>
    </div>
  </div>
</template>

<script setup>
defineProps(['activePanel', 'hasTerrain']);
defineEmits(['toggle', 'toggleTerrain']);
</script>

<style scoped>
.toolbar {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(15, 23, 42, 0.9); /*稍微加深背景*/
  backdrop-filter: blur(10px);
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.tool-item {
  /* 修改 1: 宽度自适应或固定较宽 */
  width: 130px; 
  height: 44px;
  
  /* 修改 2: 内部布局优化 */
  display: flex;
  align-items: center;
  justify-content: flex-start; /* 内容靠左 */
  padding: 0 12px; /* 左右留白 */
  gap: 10px; /* 图标和文字间距 */
  
  font-size: 15px;
  cursor: pointer;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  color: #cbd5e1;
  font-weight: 500;
  user-select: none;
}

.tool-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  transform: translateX(4px); /* 悬停时轻微右移 */
}

.tool-item.active {
  background: #3b82f6; /* 选中时的蓝色高亮 */
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.icon {
  font-size: 20px; /* 图标稍微大一点 */
  line-height: 1;
}

.label {
  /* 防止文字换行 */
  white-space: nowrap;
}
</style>