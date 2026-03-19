# BOSS Job Collector v0.1.0

首个公开版本，提供一个轻量的 `BOSS 直聘` 岗位收藏扩展。

## 这版有什么

- 把当前岗位保存到浏览器侧边栏
- 拖拽排序岗位优先级
- 编辑岗位标题、公司、地点和备注
- 导出为 Markdown 或 JSON
- 可选启用 AI 格式化 JD 文本

## 安装

1. 下载本页附件 `boss-job-collector-v0.1.0-unpacked.zip`
2. 解压压缩包
3. 打开 `chrome://extensions`
4. 开启右上角 `Developer mode`
5. 点击 `Load unpacked`
6. 选择解压后的文件夹

注意：选择的文件夹里必须直接包含 `manifest.json`。

更详细说明见 [安装文档](install.md)。

## 适用浏览器

- Chrome
- Edge
- 其他 Chromium 浏览器

## 隐私

- 默认数据只保存在本地浏览器
- 没有作者自建后端
- 只有当你主动启用 AI Format 时，JD 文本才会发送到你配置的模型服务

完整说明见 [PRIVACY.md](../PRIVACY.md)。
