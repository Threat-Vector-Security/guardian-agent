import { Theme as CustomTheme } from '../styles/Theme';

declare module '@mui/material/styles' {
  interface Theme {
    colors: CustomTheme['colors'];
  }
  
  interface ThemeOptions {
    colors?: CustomTheme['colors'];
  }
}