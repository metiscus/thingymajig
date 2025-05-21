import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// If you have a global CSS file:
// import './style.css' 

// For Font Awesome icons (if not globally included via index.html or another method)
// Ensure you have @fortawesome/fontawesome-free installed
import '@fortawesome/fontawesome-free/css/all.min.css';


const app = createApp(App)
app.use(createPinia())
app.mount('#app')