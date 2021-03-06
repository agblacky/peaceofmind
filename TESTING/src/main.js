import Vue from 'vue';
import App from './App.vue';
import GAuth from 'vue-google-oauth2';
const gauthOption = {
  clientId: '510930460352-helprk2rbp57j1p85tsv275pgopj2ldm.apps.googleusercontent.com',
  scope: 'profile email',
  prompt: 'select_account',
};

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App),
}).$mount('#app');

Vue.use(GAuth, gauthOption);
