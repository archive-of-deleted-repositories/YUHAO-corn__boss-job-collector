# Release Guide

这份文档面向仓库维护者。

## 目标

每次发版产出两个东西：

- GitHub 仓库中的源码版本
- 给非技术用户下载的 `unpacked` 安装包 zip

## 发版前检查

- 更新 [CHANGELOG.md](../CHANGELOG.md)
- 确认 [manifest.json](../manifest.json) 中的 `version`
- 确认 [README.md](../README.md) 与当前功能一致
- 确认本地未把临时文件误加入 git

## 生成 release 包

在仓库根目录执行：

```bash
./scripts/build-release.sh
```

生成结果位于：

- `release/boss-job-collector-vX.Y.Z/`
- `release/boss-job-collector-vX.Y.Z-unpacked.zip`

## 推荐发布流程

1. 更新版本号
2. 更新变更记录
3. 本地重新加载扩展验证基本功能
4. 运行打包脚本
5. 在 GitHub 创建 Release
6. 上传 `boss-job-collector-vX.Y.Z-unpacked.zip`
7. 在 Release 描述里放安装入口和 [docs/install.md](install.md) 的说明
