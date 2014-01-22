document.addEventListener("DOMContentLoaded", function() {
    chrome.permissions.getAll( function(p) {
        console.log('permissions',p)
        if (p.origins.indexOf('https://chrome.google.com/*') != -1) {
            $('#hostPermission').attr('checked',true)
            $('#hostPermission').attr('disabled',true)
        } else {
            $('#hostPermission').click( function() {
                chrome.permissions.request({origins:["https://chrome.google.com/"]}, function(r) {
                    console.log('got perm',r)
                    if (r) {
                        $('#hostPermission').attr('disabled',true)
                    } else {
                        $('#hostPermission').removeAttr('disabled')
                    }
                })
            })
        }
        
    })
})