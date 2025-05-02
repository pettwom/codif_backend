module.exports = {
  apps : [{
    name: "gestion_personal",
    script: "app.js",
    instances: 10,
  	exec_mode: 'cluster'
  }]
}
