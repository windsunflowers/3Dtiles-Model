import * as Cesium from 'cesium';

export class Tiles3DManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.tileset = null;
  }

  /**
   * 加载 3D Tiles 模型
   * @param {string} url - 模型的 json 地址
   */
  async loadTileset(url) {
    if (!this.viewer) {
      throw new Error('Viewer 未初始化');
    }

    // 移除旧模型（确保彻底清理）
    this.removeTileset();

    try {
      console.log(`正在加载模型: ${url}`);
      
      this.tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
        maximumScreenSpaceError: 16,
        skipLevelOfDetail: true,
        cullWithChildrenBounds: false
      });

      this.viewer.scene.primitives.add(this.tileset);

      await this.zoomToModel();

      return this.tileset;
    } catch (error) {
      console.error('模型加载失败:', error);
      // 失败时确保状态被清理
      this.removeTileset(); 
      throw error;
    }
  }

  /**
   * 视角飞向模型
   */
  async zoomToModel() {
    if (this.tileset) {
      return this.viewer.zoomTo(
        this.tileset,
        new Cesium.HeadingPitchRange(
          0.0, 
          -0.5, 
          this.tileset.boundingSphere.radius * 2.0
        )
      );
    }
  }

  /**
   * [新增] 统一更新模型变换参数
   * 兼容 Model.vue 中的调用方式：manager.value.updateModel({ height: ... })
   */
  updateModel(params) {
    if (!this.tileset) return;

    // 如果参数中有高度，调用 adjustHeight
    if (typeof params.height === 'number') {
      this.adjustHeight(params.height);
    }
  }

  /**
   * 调整模型高度
   * @param {number} heightOffset - 高度偏移量
   */
  adjustHeight(heightOffset) {
    if (!this.tileset) return;

    const cartographic = Cesium.Cartographic.fromCartesian(
      this.tileset.boundingSphere.center
    );
    
    const surface = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      0.0
    );
    
    const offset = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      heightOffset
    );

    const translation = Cesium.Cartesian3.subtract(
      offset,
      surface,
      new Cesium.Cartesian3()
    );

    this.tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
  }

  /**
   * 移除模型
   */
  removeTileset() {
    if (this.tileset) {
      // 从场景中移除
      this.viewer.scene.primitives.remove(this.tileset);
      
      // 显式销毁资源（可选，但在反复加载时有助于释放内存）
      if (!this.tileset.isDestroyed()) {
         this.tileset.destroy();
      }
      
      this.tileset = null;
    }
  }
}