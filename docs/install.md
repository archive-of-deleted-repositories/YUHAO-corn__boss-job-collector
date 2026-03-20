# 安装指南

这份指南面向不熟悉开发工具的用户。

## 最快路径

Release 下载页：

https://github.com/YUHAO-corn/boss-job-collector/releases/latest

1. 打开项目的 `GitHub Releases` 页面
2. 下载最新的 `boss-job-collector-vX.Y.Z-unpacked.zip`
3. 解压压缩包到一个你找得到的位置，例如桌面

## 在 Chrome 或 Edge 中安装

1. 打开浏览器
2. 在地址栏输入 `chrome://extensions`
3. 打开右上角的 `Developer mode`
4. 点击 `Load unpacked`
5. 选择刚刚解压出来的文件夹

判断文件夹选对没有，最简单的方法是：

- 打开那个文件夹后，里面应当直接看到 `manifest.json`
- 如果你点进去后还要再找一层才看到 `manifest.json`，说明你选错了上一级目录

## 安装后怎么用

1. 打开 `BOSS 直聘` 的岗位详情页
2. 点击浏览器右上角扩展图标
3. 打开 `BOSS 岗位收藏助手`
4. 点击 `Capture`
5. 在侧边栏里查看、排序、备注和导出岗位

如果你要用图片导入：

- 推荐：点击 `Image` 后，直接把截图粘贴进去
- 备用：再考虑选择本地图片文件

推荐优先使用剪贴板粘贴，因为本地文件在不同来源、分辨率或压缩方式下，更容易出现识别失败。

## 常见问题

### 为什么必须打开 Developer mode？

因为这个版本是从 GitHub 手动安装的，还没有上架到扩展商店。

### 为什么不能直接选 zip 文件？

`Load unpacked` 只能选择已经解压的文件夹，不能直接读取 zip。

### 如果浏览器提示加载失败怎么办？

优先检查两件事：

1. 你选中的是否是直接包含 `manifest.json` 的文件夹
2. 压缩包是否已经完整解压

### 数据会上传到作者服务器吗？

不会。默认数据保存在本地浏览器里。只有你主动开启 `AI Format` 时，JD 文本才会发送到你自己配置的 AI 服务。
