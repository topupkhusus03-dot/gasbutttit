const fs = require('fs');

const files = [
  'app/dashboard/page.tsx',
  'app/admin/page.tsx',
  'app/admin/programs/page.tsx',
  'app/admin/questions/page.tsx',
  'app/admin/results/page.tsx',
  'app/admin/users/page.tsx',
  'app/admin/violations/page.tsx'
];

const replacement = `async function handleLogout(e?: any) {
    if (e && e.target) {
      e.target.disabled = true;
      e.target.innerText = 'Keluar...';
    }
    await supabase.auth.signOut();
    router.push('/auth/login');
  }`;

files.forEach(file => {
  if (fs.existsSync(file)) {
    let text = fs.readFileSync(file, 'utf-8');
    
    let regex = /async function handleLogout\(\) \{[\s\n]*await supabase\.auth\.signOut\(\);[\s\n]*router\.push\('\/auth\/login'\);[\s\n]*\}/g;
    
    let newText = text.replace(regex, replacement);
    
    if (text !== newText) {
      fs.writeFileSync(file, newText, 'utf-8');
      console.log('Updated ' + file);
    }
  }
});
