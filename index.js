angular.module('filters', []).
    filter('appDisabled', function() {
        return function(input) {
            return _.filter( input, function(app) { return ! app.opts.data.enabled } )
        }
    }).
    filter('appEnabled', function() {
        return function(input) {
            return _.filter( input, function(app) { return app.opts.data.enabled } )
        }
    }).
    filter('truncate', function () {
        return function (text, length, end) {
            if (isNaN(length))
                length = 10;
 
            if (end === undefined)
                end = "...";
 
            if (text.length <= length || text.length - end.length <= length) {
                return text;
            }
            else {
                return String(text).substring(0, length-end.length) + end;
            }
 
        };
    });

var myApp = angular.module('myApp', ["filters"])
    .config( [
        '$compileProvider',
        function( $compileProvider )
        {   
            $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome):/);
            $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome|chrome-extension):/);
            // Angular before v1.2 uses $compileProvider.urlSanitizationWhitelist(...)
        }
    ]);

function reload(){chrome.runtime.reload()}

function Apps(){
    this.data = []
}
Apps.prototype.fetch = function(callback) {
    chrome.management.getAll( _.bind(this.onFetched, this, callback) )
}
Apps.prototype.onFetched = function(callback, data) {
    for (var i=0; i<data.length; i++) {
        this.data.push( new App({data:data[i]}) )
    }
    callback(this.data)
}
Apps.prototype.collectInfo = function(callback) {
    function collect(apps, app, info) {
        if (info) {
            app.info = info
            app.infoSearchable = _.values(info).join(' ').toLowerCase()
        }
        if (apps.length == 0) {
            callback()
        } else if (apps.length > 0) {
            var app = apps.pop()
            chrome.management.getPermissionWarningsById(app.id, _.bind(collect, this, apps, app))
        }
    }
    collect(this.data.slice())
}

function scrapeApps(apps, $scope, callback) {
    var totalLength = apps.length
    //console.log('scrapeapps',apps)
    function collect(apps, app, info) {
        $('#progressbar-width').css('width',Math.floor((totalLength - apps.length)/totalLength * 100) + '%')
        if (! $scope.$$phase) {
            $scope.$apply()
        }
        if (info) {
            app.scraped = info
            app.scrapedSearchable = _.values(info).join(' ').toLowerCase()
        }
        if (apps.length == 0) {
            callback()
        } else if (apps.length > 0) {
            var app = apps.pop()
            if (app.scraped) {
                // already have scraped, just return previous data
                setTimeout( function(){ collect(apps, app, app.scraped) }, 1 )
            } else {
                app.fetchDetail(_.bind(collect, this, apps, app))
            }
        }
    }
    collect(apps.slice().reverse())
}

function App(opts){
    this.opts = opts
    this.permissions_d = {}
    this.hostPermissions_d = {}

    // create fast searchable dicts ...
    if (opts.data.permissions) {
        for (var i=0; i<opts.data.permissions.length; i++) {
            this.permissions_d[opts.data.permissions[i]] = true
        }
    }
    if (opts.data.hostPermissions) {
        for (var i=0; i<opts.data.hostPermissions.length; i++) {
            this.permissions_d[opts.data.hostPermissions[i]] = true
        }
    }

    this.info = null
    this.infoSearchable = ''
    this.scraped = null
    this.scrapedSearchable = ''

    this.id = opts.data.id
    this.name = opts.data.name
    this.nameLowerCase = this.name.toLowerCase()
    this.version = opts.data.version
}
App.prototype.authorUrl = function() {
    if (this.scraped) {
        if (this.scraped.authorurl) {
            return this.scraped.authorurl
        } else {
            var url = this.scraped.website || this.scraped.author
            url = url.slice('from '.length, url.length)
            if (url.split('.').length > 1) {
                url = 'http://' + url
                return url
            } else {
                return
            }
        }
    }
}

App.prototype.showAuthor = function() {
    if (this.scraped) {
        return this.scraped.website || this.scraped.author
    }
}
App.prototype.showUsers = function() {
    if (this.scraped) {
        return this.scraped.users
    }
}
App.prototype.collectInfo = function(callback) {
    chrome.management.getPermissionWarningsById(this.id, callback)
}
App.prototype.getIcon = function(sz) {
    var icons = this.opts.data.icons;
    if (! icons) { return '' }
    for (var i=0;i<icons.length;i++) {
        if (icons[i].size == sz) {
            return icons[i].url
        }
    }
    
    return icons[0].url
}
App.prototype.fetchDetail = function(callback) {
    var url = 'https://chrome.google.com/webstore/detail/' + this.id
    var xhr = new XMLHttpRequest()
    xhr.onload = function(e) {
        var d = new DOMParser
        var result = d.parseFromString(e.target.responseText, 'text/html')
        var selector = 'div[title^="This item is created by the owner of the listed website"]'

        var starsdiv = '.rsw-stars'

        var reviewsdiv = '.webstore-Hh-sg-Nb'
        
        var authorurldiv = '.webstore-g-j-y'

        var authordiv = '.webstore-g-j-x'
        var usersdiv = '.webstore-g-j-Cd'

        var data = {}

        data['stars'] = $(starsdiv, result).attr('g:rating_override')
        data['reviews'] = $(reviewsdiv, result).text()
        data['authorurl'] = $(authorurldiv, result).attr('href')
        //data['users'] = $(usersdiv, result).text()
        data['website'] = $(selector, result).text()

        data['author'] = $(authordiv, result).text()
        data['users'] = $(usersdiv, result).text()


        //console.log('parsed dom',result)
        //console.log('scraped data:',data)

        callback(data)
    }
    xhr.onerror = function(e) {
        console.error('xhr onerror',e)
    }
    xhr.open("GET",url)
    xhr.send()
}

App.prototype.isRiskFactor = function(factor, $scope) {
    var val = true

    val = (this.opts.data.isApp && $scope.showApps) || 
        (! this.opts.data.isApp && $scope.showExtensions)
    if (! val) { return false }

    if (factor == 'high') {
        val = false
        if (this.name == 'Autocomplete on') { debugger }

        // checked that this is definitely a localized string that it returns. instead follow info from 
        // https://developer.chrome.com/extensions/permission_warnings

        if (this.opts.data.plugins) {
            val = val || true
        }

        var ps = this.opts.data.permissions
        if (ps) {
            var highrisk = 'debugger pageCapture proxy devtools_page plugins'.split(' ')

            for (var i=0; i<highrisk.length; i++) {
                if (this.permissions_d[highrisk[i]]) {
                    val = val || true
                    break
                }
            }
        }

        var ps = this.opts.data.hostPermissions
        if (ps && ! this.opts.data.isApp) {
            //if (this.name == 'Privacy Guard') { debugger }
            
            var highrisk = ['http://*/*',
                            'https://*/*',
                            '*://*/*',
                            '<all_urls>']

            for (var i=0; i<highrisk.length; i++) {
                if (this.hostPermissions_d[highrisk[i]]) {
                    val = val || true
                    break
                }
            }
                            
        }

        return val
    } else if (factor == 'low') {
        return val && this.info.length == 0
    } else if (factor == 'med') {
        return ! (this.isRiskFactor('high', $scope) || 
                  this.isRiskFactor('low', $scope))
            
    }
}

myApp.factory('apps', function() {
    var apps = new Apps();
    return apps;
});

function AppsCtrl($scope, $http, apps) {
    window.appObj = apps

    $scope.apps = [];
    $scope.allApps = [];
    $scope.appsByRisk = {}

    $scope.showApps = false
    $scope.showExtensions = true
    $scope.curFactor = 'high'

    $scope.customSearch = function(item) {
        if ( item.nameLowerCase.match($scope.searchTextLower) ) {
            return true
        }
        if (item.infoSearchable.match($scope.searchTextLower) ) {
            return true
        }
        if (item.scrapedSearchable.match($scope.searchTextLower) ) {
            return true
        }

    }

    $scope.onCheckbox = function(key, newval, oldval) {
        console.log('onCheckbox',key,newval)
        var factor = $scope.curFactor

        $scope.updateRiskFactor('low')
        $scope.numLow = $scope.apps.length

        $scope.updateRiskFactor('med')
        $scope.numMed = $scope.apps.length

        $scope.updateRiskFactor('high')
        $scope.numHigh = $scope.apps.length

        $scope.updateRiskFactor(factor)

        $scope.scrapeDetails()
    }

    var scraping = false
    $scope.scrapeDetails = function() {
        if ($scope.apps.length == 0) { return }
        if (scraping) { 
            console.log('not scraping for details, already scraping...')
            return
            // enqueue instead?
        }
        $('#progressbar-width').css('width','0%')
        $('#progressbar').show()
        scraping = true
        //console.log('scrapeapps',$scope.apps)
        scrapeApps($scope.apps, $scope, function() { 
            //console.log("scraped")
            scraping = false
            $('#progressbar').hide()
            if ($scope.apps.length > 0) {
                // $scope.$apply()
            }
        })
    }

    $scope.searchText = ''
    $scope.searchTextLower = ''

    $scope.numHigh = 0
    $scope.numMed = 0
    $scope.numLow = 0

    $scope.updateRiskFactor = function(detail, rescrape) {
        $scope.curFactor = detail

        $scope.apps = $scope.allApps.filter( function(item) {
            return item.isRiskFactor(detail, $scope)
        })
        if (rescrape) {
            $scope.scrapeDetails()
        }

    }

    $scope.myFilter = function(item) {
        var val = true
        val = val && item.opts.data.enabled

        if ($scope.searchText) {
            val = val && item.opts.data.name.match($scope.searchText)
        } else {

        }
        return val
    }

    $scope.clickApp = function(app) {
        console.log('clicked on app',app)
        app.fetchDetail( function(data) {
            app.scraped = data
            //$scope.$apply()
        })
    }

    apps.fetch(function(data) {
        $scope.allApps = data

        console.log('collectInfo')

        $scope.$watch('searchText', function(){ $scope.searchTextLower = $scope.searchText })
        $scope.$watch('showApps', _.bind($scope.onCheckbox, this, 'showApps'))
        $scope.$watch('showExtensions', _.bind($scope.onCheckbox, this, 'showExtensions'))


        apps.collectInfo( function() {
            console.log('collectedInfo')
            $scope.apps = $scope.allApps.slice()

            $scope.updateRiskFactor('low')
            $scope.numLow = $scope.apps.length

            $scope.updateRiskFactor('med')
            $scope.numMed = $scope.apps.length

            $scope.updateRiskFactor('high')
            $scope.numHigh = $scope.apps.length

            console.log('$scope.apps',$scope.apps)
            //setTimeout( function() {
            if (! $scope.$$phase) {
                $scope.$apply()
            }
            //},1)
        })
    });
}
