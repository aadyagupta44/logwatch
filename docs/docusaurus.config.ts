import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'LogWatch',
  tagline: 'AI-powered log anomaly detection',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.logwatch.dev',
  baseUrl: '/',

  organizationName: 'logwatch',
  projectName: 'logwatch',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          editUrl: 'https://github.com/logwatch/logwatch/edit/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'LogWatch',
      logo: {
        alt: 'LogWatch Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: '/docs/quickstart',
          label: 'Quickstart',
          position: 'left',
        },
        {
          to: '/docs/sdk-reference',
          label: 'SDK',
          position: 'left',
        },
        {
          to: '/docs/api-reference',
          label: 'API',
          position: 'left',
        },
        {
          to: '/docs/architecture',
          label: 'Architecture',
          position: 'left',
        },
        {
          href: 'https://github.com/logwatch/logwatch',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Quickstart', to: '/docs/quickstart'},
            {label: 'SDK Reference', to: '/docs/sdk-reference'},
            {label: 'API Reference', to: '/docs/api-reference'},
            {label: 'Architecture', to: '/docs/architecture'},
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/logwatch/logwatch',
            },
            {
              label: 'Open an issue',
              href: 'https://github.com/logwatch/logwatch/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} LogWatch. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'json', 'rust', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
