<template>
  <header class="header">3Dtiles模型展示</header>
</template>

<script setup>
// 纯展示组件，无需逻辑
</script>

<style scoped>
/* 引入 Google Fonts 赛博字体，确保字体样式生效 */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@700&display=swap');

.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100px;
  line-height: 100px;
  
  /* 字体设置 */
  font-size: 42px;
  font-family: 'Orbitron', 'Rajdhani', "Microsoft YaHei", sans-serif;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  text-align: center;
  color: #fff;
  
  /* 背景设置：优先加载图片，如果失败则显示深蓝渐变 */
  background: 
    url('../assets/images/header2.png') center/cover no-repeat;
  
  /* 层级与交互 */
  z-index: 999;
  pointer-events: none; /* 关键：让鼠标点击穿透 Header，不影响地图操作 */
  user-select: none;    /* 禁止选中文字 */

  /* 核心酷炫效果：霓虹灯文字发光 */
  text-shadow:
    0 0 5px #fff,
    0 0 10px #f7ff19,
    0 0 20px #f7ff19,
    0 0 40px rgb(193, 190, 0),
    0 0 80px rgb(255, 245, 47);

  /* 呼吸灯动画 */
  animation: glow 2s ease-in-out infinite alternate;
}

/* 呼吸灯关键帧 */
@keyframes glow {
  from {
    text-shadow:
      0 0 5px #fff,
      0 0 10px #f7ff19,
      0 0 20px rgb(238, 235, 43),
      0 0 40px rgb(206, 235, 42);
    opacity: 0.9;
  }
  to {
    text-shadow:
      0 0 10px #fff,
      0 0 20px rgb(169, 181, 0),
      0 0 30px rgb(246, 255, 0),
      0 0 50px rgb(205, 216, 0),
      0 0 90px rgb(241, 255, 85);
    opacity: 1;
  }
}
</style>