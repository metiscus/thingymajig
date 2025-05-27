<template>
  <div class="auth-container">
    <h2>Register</h2>
    <form @submit.prevent="handleRegister">
      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <button type="submit" class="primary">Register</button>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <p>Already have an account? <router-link to="/login">Login here</router-link></p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
const email = ref('');
const password = ref('');
const errorMessage = ref('');

const handleRegister = async () => {
  errorMessage.value = '';
  try {
    await authStore.register(email.value, password.value);
    // Registration success will redirect to login, so no further action here.
  } catch (error) {
    errorMessage.value = error.detail || 'Registration failed. Please try again.';
  }
};
</script>

<style scoped>
/* Re-use styles from Login.vue for consistency */
.auth-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  background-color: #fff;
}
.auth-container h2 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
button.primary {
  width: 100%;
  padding: 10px 15px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s ease;
}
button.primary:hover {
  background-color: #3aa873;
}
.error-message {
  color: #dc3545;
  margin-top: 10px;
  text-align: center;
}
p {
  margin-top: 20px;
  text-align: center;
  color: #666;
}
router-link {
  color: #42b983;
  text-decoration: none;
}
router-link:hover {
  text-decoration: underline;
}
</style>