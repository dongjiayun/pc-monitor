import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setupMockAPI } from './mock'
import './styles/main.css'

// Setup mock data for browser preview (if no Electron)
setupMockAPI()

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
