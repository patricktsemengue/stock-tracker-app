tailwind.config = {
        theme: {
          extend: {
            colors: {
              'logo-bg': '#FFF9EA', // Updated to the new color
              'logo-primary': '#2a5a54', // Dark teal from "Strady"
              'logo-green': '#6d9f82', // Light green from icon
              'logo-red': '#ef4444', // Red from arrow
              'logo-blue': '#3b82f6', // Blue from bars
              'logo-text-secondary': '#666', // Dark gray from subtitle
            },
            boxShadow: {
              'subtle': '0 1px 3px rgba(0,0,0,0.08)',
              'lg-subtle': '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
            }
          }
        }
      }