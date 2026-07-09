const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  if (content.includes('isSidebarOpen')) return;

  // 1. Inject isSidebarOpen
  content = content.replace(/const supabase = createClient\(\);/, 'const supabase = createClient();\n  const [isSidebarOpen, setIsSidebarOpen] = useState(false);');

  // 2. Add sidebar overlay and update aside className
  let asideRegex = /<aside className=\{([a-zA-Z]+)\.sidebar\}>/;
  const match = content.match(asideRegex);
  if (match) {
    const styleObj = match[1];
    
    // Replace aside
    content = content.replace(asideRegex, `{isSidebarOpen && (
        <div 
          className={${styleObj}.sidebarOverlay} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={\`${'${'}${styleObj}.sidebar} ${'${'}isSidebarOpen ? ${styleObj}.sidebarOpen : ''}\`}>`);

    // 3. Update header
    let headerRegex = new RegExp(`<header className=\\{${styleObj}\\.header\\}>\\s*<h1 className=\\{${styleObj}\\.headerTitle\\}>([^<]+)<\\/h1>\\s*<\\/header>`);
    content = content.replace(headerRegex, (m, title) => {
      return `<header className={${styleObj}.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className={${styleObj}.hamburgerBtn}
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <h1 className={${styleObj}.headerTitle}>${title}</h1>
          </div>
        </header>`;
    });
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Updated ' + filePath);
  }
}

const dir = './app/admin';
const files = ['page.tsx', 'programs/page.tsx', 'questions/page.tsx', 'results/page.tsx', 'users/page.tsx', 'violations/page.tsx'];
files.forEach(f => processFile(path.join(dir, f)));
