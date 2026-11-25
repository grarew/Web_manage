/**
 * 前端配置（通常不用改）
 *
 * 说明：
 *  网页和接口都跑在【同一个服务】上（本地 `node app.js`、Railway 部署），
 *  所以 API_BASE 留空 '' 即可，网页会自动用相对路径访问接口，不会跨域。
 *
 *  只有当网页和接口【分开部署】时（比如网页放 GitHub Pages、接口在别处），
 *  才需要把下面的 PAGES_API_BASE 改成接口的真实地址。
 */
(function () {
  var host = location.hostname;

  // 网页部署在 GitHub Pages（xxx.github.io）时使用的后端地址。
  // 正常本地运行 / Railway 部署都不会走到这个分支，不用管它。
  var PAGES_API_BASE = '';

  var isGithubPages = /\.github\.io$/i.test(host);

  window.APP_CONFIG = {
    API_BASE: isGithubPages ? PAGES_API_BASE : ''
  };
})();
