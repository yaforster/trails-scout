import browser from 'webextension-polyfill';

browser.action.onClicked.addListener(() => browser.sidebarAction.open());
