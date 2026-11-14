/**
 * 前端配置项（唯一需要改的地方）
 *
 * 规则：
 *  - 页面和接口在【同一个服务】上（本地 `node app.js`、Render 单服务部署）
 *      → API_BASE 留空字符串 ''，fetch 会走相对路径 /api/activities，天然不跨域
 *  - 前端【独立部署】（如 GitHub Pages）而后端在别处
 *      → 把下面的 PAGES_API_BASE 改成后端线上地址
 *
 * 注意：这里只放地址，不要写业务逻辑。
 */
(function () {
  var host = location.hostname;

  // 当页面部署在 GitHub Pages（xxx.github.io）时使用的后端地址。
  // 部署 Render 后，把它改成 Render 实际分配的域名。
  var PAGES_API_BASE = 'https://web-manage-api.onrender.com';

  var isGithubPages = /\.github\.io$/i.test(host);

  window.APP_CONFIG = {
    API_BASE: isGithubPages ? PAGES_API_BASE : ''
  };
})();
