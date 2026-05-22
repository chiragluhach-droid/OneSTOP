async function test() {
  try {
    const loginRes2 = await fetch('http://127.0.0.1:5001/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'luhachchirag@gmail.com', // Try seeded
        password: 'admin123secure'
      })
    });
    const data = await loginRes2.json();
    
    if (!data.success) {
      console.log('Login failed:', data);
      return;
    }
    console.log('Login success!');
    const token = data.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('Fetching schools...');
    const schools = await fetch('http://127.0.0.1:5001/api/schools', { headers }).then(r => r.json());
    console.log('Schools OK:', schools.success, schools.message);

    console.log('Fetching teachers...');
    const teachers = await fetch('http://127.0.0.1:5001/api/teachers', { headers }).then(r => r.json());
    console.log('Teachers OK:', teachers.success, teachers.message);

    console.log('Fetching requests...');
    const requests = await fetch('http://127.0.0.1:5001/api/requests/admin/all', { headers }).then(r => r.json());
    console.log('Requests OK:', requests.success, requests.message);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
