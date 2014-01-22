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

function App(opts){
    this.opts = opts

    this.info = null

    this.id = opts.data.id
    this.name = opts.data.name
    this.version = opts.data.version
}
App.prototype.collectInfo = function(callback) {
    chrome.management.getPermissionWarningsById(this.id, callback)
}
App.prototype.getIcon = function(sz) {
    var icons = this.opts.data.icons;
    for (var i=0;i<icons.length;i++) {
        if (icons[i].size == sz) {
            return icons[i].url
        }
    }
    return icons[0].url
}
App.prototype.fetchDetail = function() {
    var url = 'https://chrome.google.com/webstore/detail/' + this.id
    var xhr = new XMLHttpRequest()
    xhr.onload = function(e) {
        var d = new DOMParser
        var result = d.parseFromString(e.target.responseText, 'text/html')
        var selector = 'div[title^="This item is created by the owner of the listed website"]'
        var elt = $(selector, result)
        var author = $(elt).text()

        console.log('xhr onload',e.target.responseText)
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

    if (factor == 'high') {
        val = val && this.info.length > 1
    } else if (factor == 'med') {
        val = val && this.info.length == 1
    } else if (factor == 'low') {
        val = val && this.info.length == 0
    }
    return val
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

    $scope.onCheckbox = function(key, newval, oldval) {
        $scope.apps = _.filter( $scope.allApps, function(app) {
            return ($scope.showApps && app.opts.data.isApp) ||
                ($scope.showExtensions && ! app.opts.data.isApp)
        })
        //console.log('oncheckbox',key,newval,oldval)
    }

    $scope.$watch('showApps', _.bind($scope.onCheckbox, this, 'showApps'))
    $scope.$watch('showExtensions', _.bind($scope.onCheckbox, this, 'showExtensions'))

    $scope.searchText = ''

    $scope.numHigh = 20
    $scope.numLow = 10
    $scope.numTotal = 100

    $scope.updateRiskFactor = function(detail) {
        console.log('update risk factor',detail,this)
        $scope.apps = $scope.allApps.filter( function(item) {
            return item.isRiskFactor(detail, $scope)
        })

    }

    $scope.clickButton = function() {
        console.log('clickbutton')
        $scope.$digest()
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
        app.fetchDetail()
    }

    apps.fetch(function(data) {
        $scope.allApps = data

        //$scope.$apply()
        apps.collectInfo( function() {
            $scope.apps = $scope.allApps.slice()
            //$scope.onCheckbox()
            $scope.updateRiskFactor('high')
            $scope.$apply()
        })
    });
}
