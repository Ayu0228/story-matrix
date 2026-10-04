# 灵感矩阵（GitHub 版）部署指南

把这套静态网页部署到你的 GitHub Pages，数据存你自己的 GitHub 私有仓库。
全程在浏览器里点鼠标完成，不需要安装任何软件，不需要懂编程。

---

## 一、部署网站（约 10 分钟）

### 第 1 步：注册 GitHub 账号
打开 https://github.com 注册。用户名（username）后面会用在网址里，想好再填。

### 第 2 步：建一个【公开】仓库放网站
1. 登录后点右上角 `+` → **New repository**
2. 仓库名填 `story-matrix`（可自定，网址会用到）
3. 选 **Public（公开）**
4. 点 **Create repository**

### 第 3 步：上传本文件夹里的所有文件
1. 进入刚建的仓库，点 **uploading an existing file**（或 Add file → Upload files）
2. 把本文件夹的**全部内容**拖进去：`index.html`、`matrix.html`、`studio.html`、`method.html`、`assets` 整个文件夹、`.nojekyll`、`README.md`
   - `assets` 文件夹直接整个拖进去，GitHub 会自动保留目录结构
3. 点 **Commit changes**

### 第 4 步：开启 Pages，拿到网址
1. 仓库顶部 **Settings** → 左侧 **Pages**
2. Source 选 **Deploy from a branch**，Branch 选 **main**、目录选 **/(root)**，点 **Save**
3. 等 1～3 分钟，刷新 Pages 页面，会看到网址：`https://你的用户名.github.io/story-matrix/`
4. 打开这个网址，能看到灵感矩阵首页就成功了
5. **在浏览器里按 Ctrl+D（Mac 按 Cmd+D）加书签**，以后从书签进

---

## 二、接上你的私有数据仓库（约 5 分钟，做一次）

网站本身没有数据库。你添加的自定义人物关系、自定义故事场景、保存的配方，
全部存在一个**只有你能看到**的 GitHub 私有仓库里。

### 第 5 步：建一个【私有】仓库放数据
1. 再点 **New repository**
2. 仓库名填 `my-story-data`（可自定，记住名字）
3. 选 **Private（私有）** ← 重要
4. 勾不勾 README 都行，点 **Create repository**

### 第 6 步：生成一把"只开这一扇门"的钥匙（令牌）
1. 右上角头像 → **Settings** → 最底部 **Developer settings**
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
3. 填个名字（如 `story-matrix`），有效期建议 1 年
4. 关键一步：**Repository access** 选 **Only select repositories**，
   只勾选第 5 步建的私有仓库 `my-story-data`
5. **Permissions** 里找到 **Contents**，选 **Read and write**（读写）
6. 点 **Generate token**，**立刻复制**那串 `github_pat_...`（只显示一次）

### 第 7 步：在网站里连接
1. 打开你的网站 → 右上角点 **「存储」**
2. 依次填入：GitHub 用户名、私有仓库名（`my-story-data`）、刚复制的令牌
3. 点保存，按钮变绿「已连接」即成功

### 第 8 步：加书签
按 Ctrl+D 把网站加进浏览器书签。以后点开书签就能用，数据自动同步。

---

## 三、常见问题

**换电脑/换手机怎么办？**
打开同一个网址，点右上角「存储」，把第 6～7 步再填一遍即可，数据都在。

**令牌安全吗？**
令牌只保存在**你自己浏览器**的本地存储里，不会上传给任何第三方，
网站代码里也没有后门。别人打开你的网址看不到数据——他们没有你的令牌。

**右上角变红「同步失败」？**
点它重新填一次令牌（可能过期了），或检查私有仓库名有没有填错。

**不连存储能用吗？**
能。浏览、随机配方永远可用；只是自定义内容和保存的配方只存在当前浏览器，
清浏览器数据会丢，换设备也不同步。

**网站文件是公开的，数据会泄露吗？**
不会。公开仓库里只有网页代码，数据存在你的私有仓库，两者分开。

---

## 四、本地预览（可选，给爱折腾的人）

直接双击 `index.html` 就能在浏览器里打开；或者：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```
