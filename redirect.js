(function() {
    var oldDomain = "yobasic.com";
    var newDomain = "uibasic.com";
    var currentHost = window.location.hostname;

    if (currentHost === oldDomain || currentHost === "www." + oldDomain) {
        var newUrl = window.location.href.replace(currentHost, newDomain);
        window.location.replace(newUrl);
    }
})();
