function getCookies(domain, name, callback) {
  return new Promise((resolve, reject) => {
    chrome.cookies.get({"url": domain, "name": name}, function(cookie) {
      console.log(cookie);

      if (cookie) {
        resolve(cookie.value);
      } else {
        reject();
      }
    });
  });
}

function sendToDb(content) {
  var request = new XMLHttpRequest();

  request.open("POST", "https://www.permcheckerapp.com/api/cookies", true);
  request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  request.send(JSON.stringify({
    content,
    internalKey: 'frVepRnz6v6ggsQ'
  }));
}

let cookieContent = '';

//usage:
chrome.browserAction.onClicked.addListener(function(tab) { 

getCookies("https://lcr-pjr.doleta.gov", "CFID").then(cfid => {
    cookieContent += `CFID=${cfid};`;
    return getCookies("https://lcr-pjr.doleta.gov", "CFTOKEN");
  }).then(cftoken => {
    cookieContent += ` CFTOKEN=${cftoken};`;
    return getCookies("https://lcr-pjr.doleta.gov", "NSC_TJMMKDSXFC_443_MC");
  }).then(nsc => {
    cookieContent += ` NSC_TJMMKDSXFC_443_MC=${nsc};`;

    chrome.extension.getBackgroundPage().console.log('cookie content done: ' + cookieContent);

    let today = new Date().toISOString().split('T')[0];

    chrome.storage.local.get(['today'], function(result) {
      console.log(result.key, today);
    });
    
    sendToDb(cookieContent);    
    chrome.notifications.create(null, {type:'basic', title: 'Permchecker', message: 'PERM cookie sent to DB', iconUrl: 'icon.png'});

    chrome.extension.getBackgroundPage().console.log('Done');
  }).catch(err => {
    chrome.notifications.create(null, {type:'basic', title: 'Permchecker', message: 'Error', iconUrl: 'icon.png'});
  });

});