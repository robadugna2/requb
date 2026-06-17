const axios = require('axios');

async function test() {
  try {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'tesfay_alemkahsay@gmail.com',
      password: 'Password123!' // assuming default or wait, I don't know the password
    });
    console.log("Login success");
  } catch (e) {
    console.log("Login failed");
  }
}
test();
