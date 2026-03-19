# BOSS Job Collector

`BOSS 岗位收藏助手` 是一个面向 `BOSS 直聘` 的 Chromium 扩展，用来把岗位详情快速保存到侧边栏，方便后续筛选、排序、备注和导出。

下载入口：
- 最新版本下载页：https://github.com/YUHAO-corn/boss-job-collector/releases/latest
- 当前首个公开版本：https://github.com/YUHAO-corn/boss-job-collector/releases/tag/v0.1.0

这个仓库同时服务两类人：
- 想直接安装使用的用户
- 想自行修改或收录源码的开发者

## 功能

- 在 `BOSS 直聘` 页面一键抓取当前岗位
- 在侧边栏集中查看已保存岗位
- 拖拽排序岗位优先级
- 直接编辑岗位标题、公司、地点、备注
- 导出为 `Markdown` 或 `JSON`
- 可选启用 AI 格式化 JD 文本

## 适用范围

- 浏览器：`Chrome`、`Edge`、其他兼容 Chromium 的浏览器
- 网站：当前抓取逻辑面向 `https://www.zhipin.com/*`

## 快速安装

给急着使用的非技术用户，推荐直接从 `GitHub Releases` 下载打包好的安装包：

https://github.com/YUHAO-corn/boss-job-collector/releases/latest

1. 打开本项目的 `Releases` 页面
2. 下载 `boss-job-collector-vX.Y.Z-unpacked.zip`
3. 解压压缩包
4. 在浏览器地址栏打开 `chrome://extensions`
5. 打开右上角 `Developer mode`
6. 点击 `Load unpacked`
7. 选择解压后的文件夹

注意：
- 选择的必须是“里面直接能看到 `manifest.json` 的文件夹”
- 不要直接选择 zip 文件
- 不要误选上一级目录

更详细的图文说明见 [docs/install.md](docs/install.md)。

## 使用方法

1. 打开一个 `BOSS 直聘` 岗位详情页
2. 点击浏览器工具栏中的扩展图标，打开侧边栏
3. 点击 `Capture`
4. 在侧边栏中查看、排序、编辑或导出岗位

## AI JD 格式化

AI 格式化默认关闭。

你可以在侧边栏的 `AI Format` 设置里填写：
- Provider
- Model
- Endpoint / Base URL
- API Key

当前支持：
- `OpenAI`
- `Anthropic`
- 兼容 OpenAI 接口格式的服务，例如豆包 Ark

启用后，岗位 JD 文本会发送到你配置的模型服务进行格式化。隐私说明见 [PRIVACY.md](PRIVACY.md)。

## 本地开发

1. 克隆或下载本仓库
2. 打开 `chrome://extensions`
3. 打开 `Developer mode`
4. 点击 `Load unpacked`
5. 选择仓库根目录

当前扩展入口文件：
- [manifest.json](manifest.json)
- [sidepanel.html](sidepanel.html)
- [sidepanel.js](sidepanel.js)

## 发布

仓库内已经提供 release 打包脚本：

```bash
./scripts/build-release.sh
```

脚本会生成：
- `release/boss-job-collector-vX.Y.Z/`
- `release/boss-job-collector-vX.Y.Z-unpacked.zip`

维护说明见 [docs/release.md](docs/release.md)。

## 隐私

- 岗位数据默认保存在浏览器本地 `chrome.storage.local`
- 项目没有自建后端，也不会把你的数据上传到作者服务器
- 只有当你主动开启 AI 格式化时，JD 文本和你填写的配置才会用于请求你指定的模型服务

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 已知限制

- 当前只适配 `BOSS 直聘` 的现有页面结构
- 如果目标网站 DOM 结构变化，抓取逻辑可能失效
- `Load unpacked` 安装方式适合临时使用；长期面向普通用户分发，后续更适合上架扩展商店

## 版本记录

版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## License

本项目采用 [MIT License](LICENSE)。
