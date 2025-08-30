tailwind.config = {
        theme: {
          extend: {
            colors: {
              'logo-bg': '#f7f4ec',
              'logo-primary': '#2a5a54',
              'logo-green': '#6d9f82',
              'logo-red': '#ef4444',
              'logo-blue': '#3b82f6',
              'logo-text-secondary': '#666',
              'neutral-text': 'var(--text-color)',
              'neutral-card': 'var(--card-bg-color)',
              'neutral-bg': 'var(--bg-color)',
              'neutral-secondary-text': 'var(--secondary-text-color)',
            },
            boxShadow: {
              'subtle': '0 1px 3px rgba(0,0,0,0.08)',
              'lg-subtle': '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
            }
          }
        }
      }