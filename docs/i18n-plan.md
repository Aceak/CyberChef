# CyberChef i18n 方案

## 目标

将代码中所有硬编码的英文字符串分离到 locale 文件中，建立 i18n 机制，使添加新语言只需新增 JSON 翻译文件。

---

## 架构

```
src/core/
├── lib/
│   └── I18n.mjs                  ← 新建：i18n 核心模块
├── locales/
│   └── en/                        ← 英文 locale（唯一数据源）
│       ├── ui.json                ← UI 界面文字
│       ├── options.json           ← 设置面板文字
│       ├── messages.json          ← 动态消息 / alert / confirm
│       ├── operations.json        ← 操作名 & 描述
│       ├── categories.json        ← 分类名
│       └── help.json              ← data-help 帮助文案
```

---

## 核心模块：`I18n.mjs`

```javascript
class I18n {
    static locale = "en";           // 当前语言
    static data   = {};             // 已加载的翻译数据 { en: {...}, zh: {...} }

    static async init(locale)       // 初始化，加载指定语言的 locale JSON + en fallback
    static t(key)                   // 查当前语言 → 没有则查 en → 还没有 warn + 返回 key
    static async changeLanguage(l)  // 切换语言，加载新 locale，重新应用到 DOM
    static applyToDOM()             // 遍历 [data-i18n*] 属性，替换文本
}
```

### `t(key)` 查找逻辑

```
1. 查 I18n.data[currentLocale]（逐级 . 拆开查嵌套 key）
2. 没找到且 currentLocale !== "en" → 查 I18n.data["en"]
3. 都没找到 → console.warn + 返回 key 本身
```

### `applyToDOM()` 规则

| 属性 | 作用 |
|------|------|
| `data-i18n` | 替换元素的 `textContent`（只改文本节点，保留子元素） |
| `data-i18n-title` | 替换 `title` 属性 |
| `data-i18n-help-title` | 替换 `data-help-title` 属性 |
| `data-i18n-help` | 替换 `data-help` 属性 |
| `data-i18n-placeholder` | 替换 `placeholder` 属性 |

HTML 标签内的原始英文文字作为开发可读标记，加载后被 locale 值覆盖。

---

## Key 命名规则

- `.` 表示层级分隔
- `_` 在叶子层拼接多词
- 全小写，无其他特殊符号
- 操作名/参数名 → key 的转换：`name.toLowerCase().replace(/[\s\/\-\.]+/g, "_")`

### 命名空间

| 前缀 | 用途 | 示例 |
|------|------|------|
| `ui.*` | UI 控件文字 | `ui.controls.bake` |
| `options.*` | 设置面板 | `options.theme` |
| `messages.*` | 动态提示 | `messages.invalid_recipe` |
| `op.name.*` | 操作名 | `op.name.to_base64` |
| `op.desc.*` | 操作描述 | `op.desc.to_base64` |
| `op.arg.{op}.{arg}` | 操作参数名 | `op.arg.aes_encrypt.key` |
| `op.arg.{op}.{arg}_hint` | 操作参数 hint | `op.arg.aes_encrypt.key_hint` |
| `cat.*` | 分类名 | `cat.data_format` |
| `ui_help.*` | 帮助文案 | `ui_help.operations_list` |

---

## 各文件处理方案

### 1. `index.html` — `data-i18n` 属性标记

```html
<!-- 之前 -->
<button id="bake"><span>Bake!</span></button>
<a href="#" id="options">Options <i class="material-icons">settings</i></a>
<input id="search" type="search" placeholder="Search...">

<!-- 之后 -->
<button id="bake"><span data-i18n="ui.controls.bake">Bake!</span></button>
<a href="#" id="options" data-i18n="ui.banner.options">Options <i class="material-icons">settings</i></a>
<input id="search" type="search" data-i18n-placeholder="ui.operations.search_placeholder" placeholder="Search...">
```

加载提示 `loadingMsgs` 先不动（纯趣味文案）。

### 2. `OperationConfig.json` — 不动原文件

`HTMLOperation.mjs` 构造时做 i18n 查找：

```javascript
this.name        = I18n.t("op.name." + name.toLowerCase().replace(/[\s\/\-\.]+/g, "_"));
this.description = I18n.t("op.desc." + name.toLowerCase().replace(/[\s\/\-\.]+/g, "_"));
```

查找不到 → fallback 到 en locale → 都没有则返回 key。

### 3. `Categories.json` — 不动原文件

`HTMLCategory.mjs` 构造时：

```javascript
this.name = I18n.t("cat." + name.toLowerCase().replace(/[\s\/\-\.]+/g, "_"));
```

### 4. `HTMLOperation.mjs` / `HTMLCategory.mjs` / `HTMLIngredient.mjs`

`toHtml()` / `toStubHtml()` / `toFullHtml()` 生成的 HTML 中，给文本节点加上 `data-i18n`。

Ingredient 的 name/hint 第一阶段不提取（机制已规划好，用 `op.arg.{op}.{arg}` 命名空间）。

### 5. JS 中的动态字符串

```javascript
// 之前
this.app.alert("Invalid recipe", 2000);
btnText.innerText = "Bake!";

// 之后
this.app.alert(I18n.t("messages.invalid_recipe"), 2000);
btnText.innerText = I18n.t("ui.controls.bake");
```

涉及文件：
- `App.mjs` — alert/confirm 消息
- `ControlsWaiter.mjs` — Bake/Cancel/Loading 等按钮文字
- `InputWaiter.mjs` — EOL 检测提示等
- `OutputWaiter.mjs` — 保存/输出相关消息

### 6. `statusBar.mjs` — 状态栏文字

构造 HTML 时写入 `data-i18n` / `data-i18n-title` / `data-i18n-help` / `data-i18n-help-title`。

### 7. Language 选项

`index.html` Options 面板中，Theme 紧下方添加：

```html
<div class="form-group option-item">
    <label for="language" class="bmd-label-floating" data-i18n="options.language">Language</label>
    <select class="form-control" option="language" id="language">
        <option value="en">English</option>
    </select>
</div>
```

`defaultOptions` 加 `language: "en"`。

`OptionsWaiter.selectChange` 已能自动处理持久化。新增 `languageChange()`：

```javascript
async languageChange(e) {
    await I18n.changeLanguage(e.target.value);
    I18n.applyToDOM();
}
```

---

## 实施步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| S1 | 创建 `I18n.mjs` 核心模块 | 新建 |
| S2 | 创建 `en/` locale JSON 文件（6个） | 新建 |
| S3 | `App.mjs` 集成 I18n：初始化 + `applyToDOM()` | 修改 |
| S4 | `index.html` 添加 `data-i18n` 属性 + Language 下拉 | 修改 |
| S5 | `index.js` / `OptionsWaiter` / `Manager` 添加 Language 支持 | 修改 |
| S6 | `HTMLOperation` / `HTMLCategory` 构造时查 i18n | 修改 |
| S7 | JS 动态字符串改为 `I18n.t()` | 修改多个 Waiter |
| S8 | `statusBar` 帮助文案加 `data-i18n` | 修改 |
| S9 | 端到端验证 | — |

---

## 未来加新语言

只需两步：

1. 复制 `src/core/locales/en/` → `src/core/locales/zh/`
2. 把值改成中文，缺 key 自动 fallback 到英文
3. 在 Language 下拉加 `<option value="zh">中文</option>`
