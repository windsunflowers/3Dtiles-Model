import * as Cesium from 'cesium';

export class Tiles3DManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.tileset = null;
  }

  /**
   * 内部通用加载处理逻辑
   * 无论是 URL 还是 Ion ID，最终都返回一个 Tileset Promise，后续处理逻辑是一样的
   */
  async _handleLoad(tilesetPromise) {
    if (!this.viewer) throw new Error('Viewer 未初始化');

    // 1. 移除旧模型
    this.removeTileset();

    try {
      // 2. 等待模型实例化完成
      this.tileset = await tilesetPromise;

      // 3. 添加到场景
      this.viewer.scene.primitives.add(this.tileset);

      // 4. 处理 Ion 资源的默认样式 (如果有)
      if (this.tileset.asset && this.tileset.asset.extras?.ion?.defaultStyle) {
         this.tileset.style = new Cesium.Cesium3DTileStyle(this.tileset.asset.extras.ion.defaultStyle);
      }

      // 5. 缩放视角
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
   * 通过 URL 加载 (原始功能)
   */
  async loadFromUrl(url) {
    console.log(`正在从 URL 加载: ${url}`);
    const promise = Cesium.Cesium3DTileset.fromUrl(url, {
      maximumScreenSpaceError: 16,
      skipLevelOfDetail: true,
      cullWithChildrenBounds: false
    });
    return this._handleLoad(promise);
  }

  /**
   * 通过 Ion Asset ID 加载 (新增功能)
   */
  async loadFromIon(assetId) {
    console.log(`正在加载 Ion 资源: ${assetId}`);
    const promise = Cesium.Cesium3DTileset.fromIonAssetId(assetId);
    return this._handleLoad(promise);
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
   * 统一更新模型变换参数
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
      
      // 显式销毁资源
      if (!this.tileset.isDestroyed()) {
         this.tileset.destroy();
      }
      
      this.tileset = null;
    }
  }
}