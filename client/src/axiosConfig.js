import axios from 'axios';

const instance = axios.create({
  baseURL: window.location.pathname.includes('mertis') ? '/mertis' : ''
});

export default instance;
