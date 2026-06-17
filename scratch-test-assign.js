const axios = require('axios');

async function test() {
  try {
    const loginRes = await axios.post('http://127.0.0.1:3001/api/auth/login', {
      email: 'tesfay_alemkahsay@gmail.com',
      password: 'Password123!'
    });
    const token = loginRes.data.accessToken;

    try {
      // Intentional invalid payload: canManageMembers is a string instead of boolean
      const assignRes = await axios.post(`http://127.0.0.1:3001/api/admins/cmqh6f6cz000267mj4iefpm2v/groups`, {
        groupId: 'cmqh5w5ft0004setfpb6z2jde',
        canManageMembers: "NOT A BOOLEAN",
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Success");
    } catch (assignErr) {
      console.log("Failed");
      console.log("Data:", JSON.stringify(assignErr.response?.data));
    }
  } catch (e) {
    console.log("Login failed");
  }
}
test();
