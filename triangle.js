/**
 * Shell for angular
 * requires angular, underscore
 *
 * last revision: 14.11.2014
 */
(function (window, angular, _) {
    /**
     * Directive types constant
     * @type {{ELEMENT: string, ATTRIBUTE: string, CLASS: string, COMMENT: string}}
     */
    Triangle.DIRECTIVE_TYPE = {
        ELEMENT: 'E', //can be an element
        ATTRIBUTE: 'A', // element attribute
        CLASS: 'C', //css class
        COMMENT: 'M'//comment
    };

    Triangle.EVENT = {
        ADD: 'add',
        REMOVE: 'remove',
        RESET: 'reset'
    };

    Triangle.camelCase = function (s) {
        s = angular.isString(s) && s.trim() ? s.replace(/[^_a-zA-Z0-9\s\-]*/g, '', s) : '';
        s = s ? s.replace(/([_\-\s])([a-z])/g, function (t, a, b) {
            return b.toUpperCase();
        }) : '';
        return s;
    };

    Triangle.snakeCase = function (s) {
        s = angular.isString(s) && s.trim() ? s.replace(/[^a-zA-Z0-9]/g, '_', s) : '';
        s = s ? s.replace(/^_+|_+$/g, '') : '';

        //s = s?s.replace(' ', function(t,a,b){return b.toUpperCase();}): '';
        return s;
    };


    /**
     * Short hand for console.warn() with triangle text label
     * @param text
     */
    var warning = function (text) {
        console.warn('Triangle warning: ' + text);
        console.trace();
    };

    var log = function (text) {
        if (window.test) {
            console.log(text);
        }
    };

    Triangle.setData = function (collection, data) {
        if (angular.isArray(data)) {
            data.forEach(function (item) {
                collection.add(item);
            });
        }
    };

    var rand = function (min, max) {
        if (typeof max == 'undefined') {
            max = min;
            min = 0;
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    /**
     * Return random string like 3A11EA
     * @returns {string}
     */
    var str16 = function () {
        return rand(0xFFFFFF).toString(16).toUpperCase();
    };

    /**
     * Generate random id like a 45486B-5718F5-BB696A-2A41BC
     * @returns {string}
     */
    Triangle.genId = function () {
        return _('abcd').map(str16).join('-');
    };

    /**
     * Triangle collections
     */
    Triangle.collection = (function () {
        var collections = {};

        /**
         * Private collection methods
         */
        var PRIVATE = {
            bindFilterProperty: function (item, key, collection) {
                var definer = {
                    item: item,
                    key: key,
                    collection: collection,
                    value: null,

                    apply: function () {
                        if (angular.isObject(definer.value) && !angular.isFunction(definer.value.apply)) {
                            definer.value.apply = definer.apply;
                        }
                        definer.collection.$childCollections.forEach(function (childCollection) {
                            var matched = childCollection.separator.call(childCollection.collection, item);
                            var index = childCollection.collection.indexOf(item);
                            if (!matched && index >= 0) {
                                childCollection.collection.splice(index, 1);
                            }
                            if (matched && index < 0) {
                                childCollection.collection.push(item);
                                if (childCollection.collection.$childCollections) {
                                    childCollection.collection.$childCollections.forEach(function (childCollection) {
                                        childCollection.apply();
                                    });
                                }
                            }
                        });
                    }
                };

                var bindResult = item[key];

                try {
                    Object.defineProperty(definer.item, definer.key, {
                        writeable: true,
                        enumerable: true,
                        configurable: false,
                        get: function () {
                            return definer.value;
                        },
                        set: function (newValue) {
                            if (definer.value != newValue) {
                                definer.value = newValue;
                                definer.apply();
                            }
                        }
                    });
                } catch (e) {
                    bindResult = null;
                }
                return bindResult;
            },

            bindParentCollectionProperty: function (item, key, collection, filterProperty) {
                var value = item[key];

                if (!item._appliers) {
                    item._appliers = {};
                }

                if (!item._appliers[key]) {
                    item._appliers[key] = [];
                }

                item._appliers[key].push({
                    collection: collection,
                    filterProperty: filterProperty
                });

                //collection.$relatedCollection.filter[filterProperty] = value;
                try {
                    Object.defineProperty(item, key, {
                        writeable: true,
                        enumerable: true,
                        configurable: false,
                        get: function () {
                            return value;
                        },
                        set: function (newValue) {
                            if (value != newValue) {
                                value = newValue;
                                item._appliers[key].forEach(function (applier) {
                                    applier.collection.$relatedCollection.filter[applier.filterProperty] = value;
                                    applier.collection.$relatedCollection.apply();
                                });
                            }
                        }
                    });
                } catch (e) {
                }
            },

            /**
             * Default filter function
             * @param item
             * @returns {boolean}
             */
            separator: function (item) {
                for (var key in this.$relatedCollection.filter) {
                    if (!angular.equals(item[key], this.$relatedCollection.filter[key])) {
                        return false;
                    }
                }
                return true;
            },

            /**
             * Refill filtered collection
             */
            apply: function () {
                this.splice(0, this.length);
                this.$relatedCollection.collection.forEach(function (item) {
                    if (this.$relatedCollection.separator.call(this, item)) {
                        this.push(item);
                        this.trigger(Triangle.EVENT.ADD, item);
                    }
                }, this);
            }
        };

        /**
         * Collection methods
         */
        var COLLECTION = {
            /**
             * Set this collection as filtered
             * @param collection
             * @param filter
             * @param separator
             * @returns {boolean}
             */
            relate: function (collection, filter, separator) {
                if (!angular.isObject(collection)) {
                    if (collections[collection]) {
                        collection = collections[collection];
                    } else {
                        warning("Collection '" + collection + "' doesn't exists");
                        return false;
                    }
                }

                if (!angular.isObject(filter)) {
                    warning("Filter is required");
                    return false;
                }

                if (!angular.isFunction(separator)) {
                    separator = PRIVATE.separator;
                }
                var applyFunction = PRIVATE.apply.bind(this);

                this.bind = _.unique(this.bind.concat(Object.keys(filter)));
                this.$relatedCollection = {
                    collection: collection,
                    filter: filter,
                    separator: separator,
                    apply: applyFunction
                };

                collection.bind = _.unique(collection.bind.concat(Object.keys(filter)));
                collection.$childCollections.push({
                    collection: this,
                    filter: filter,
                    separator: separator,
                    apply: applyFunction
                });
            },

            /**
             * Append filtered collection into each collection item
             *
             * {
                //parent collection
                collection: 'people',
                //child collection name
                name: 'people',
                // relations
                bind: {
                    peopleId: 'id'
                },
                // child collection defaults
                separator: function(item){
                    return true;
                },
                // collection defaults
                defaults: {
                    url: '/serverSyncUrl'
                }
                }
             *
             * @param params
             * @returns {boolean}
             */
            setChildCollection: function (params) {
                if (!params.collection) {
                    warning('Parent collection is undefined (use {collection: parentCollection} or {collection: \'collection name\'})');
                    return;
                }

                if (!angular.isObject(params.collection)) {
                    if (collections[params.collection]) {
                        params.collection = collections[params.collection];
                    } else {
                        warning("Collection '" + params.collection + "' doesn't exists");
                        return false;
                    }
                }

                if (!angular.isObject(params.bind)) {
                    warning("Bind is required. Use {bind: {id: 'relatedId'}}");
                    return false;
                }

                //params.defaults = params.defaults || null;
                params.name = params.name || params.collection.name;
                params.relation = params.relation || PRIVATE.relation;
                params.separator = params.separator || PRIVATE.separator;

                this.$generatedCollections.push(params);

                this.$generatedCollections.forEach(function (relation) {
                    relation.collection.bind = _.unique(relation.collection.bind.concat(_.toArray(relation.bind)));
                });
            },

            /**
             * Add item to collection
             * @param item
             * @returns {*}
             */
            add: function (item) {
                if (typeof item == 'undefined') {
                    item = {};
                }

                if (this.$relatedCollection) {
                    _.defaults(item, angular.copy(this.$relatedCollection.filter), angular.copy(this.defaults));
                    var newItem = this.$relatedCollection.collection.add(item);
                    this.trigger(Triangle.EVENT.ADD, newItem);
                    return newItem;
                }

                if (!item.id) {
                    item.id = Triangle.genId();
                }

                _.defaults(item, angular.copy(this.defaults));

                this.$generatedCollections.forEach(function (relation) {
                    var childCollection = item[relation.name] = Triangle.collection(relation.collection.name + '=>' + this.name + '[' + item.id + '].' + relation.name, relation.defaults);
                    var filter = {};
                    //childCollection.parent = item;
                    childCollection.$parentCollection = this;

                    for (var k in relation.bind) {
                        filter[relation.bind[k]] = item[k];
                        PRIVATE.bindParentCollectionProperty(item, k, childCollection, relation.bind[k]);
                    }
                    childCollection.relate(relation.collection.name, filter, relation.separator);
                    childCollection.$relatedCollection.apply();
                }, this);

                item.remove = (function (collection, item) {
                    return function (preventDeleteChilds, syncWithServer, callback) {
                        collection.remove(item, preventDeleteChilds);
                        if (syncWithServer && angular.isFunction(collection.save)) {
                            if (!angular.isFunction(callback)) {
                                callback = angular.noop;
                            }
                            collection.save(callback);
                        }
                    };
                })(this, item);

                item.toJSON = (function (collection, item) {
                    return function (withoutId, noDeep) {
                        return collection.toJSON(item, withoutId, noDeep)[0];
                    };
                })(this, item);

                item.getIndex = (function (collection, item) {
                    return function () {
                        return collection.getIndex(item);
                    };
                })(this, item);

                if (this.url) {
                    item.destroy = (function (collection, item) {
                        return function (preventDeleteChilds, callback) {
                            if (angular.isFunction(preventDeleteChilds)) {
                                callback = preventDeleteChilds;
                                preventDeleteChilds = null;
                            }
                            item.remove(preventDeleteChilds, true, callback);
                        };
                    })(this, item);
                }

                this.push(item);
                this.bind.forEach(function (key) {
                    item[key] = PRIVATE.bindFilterProperty(item, key, this);
                }, this);

                this.trigger(Triangle.EVENT.ADD, item);
                return item;
            },

            /**
             * Return JSON object from collection
             * @param collectionItem (get only one item)
             * @param withoutId
             * @param noDeep
             * @returns {Array}
             */
            toJSON: function (collectionItem, withoutId, noDeep) {
                var results = [], result, generated = {};

                this.$generatedCollections.forEach(function (collection) {
                    generated[collection.name] = true;
                });
                var items = collectionItem ? [this.get(collectionItem)] : this;
                items.forEach(function (item) {
                    result = {};
                    for (var k in item) {
                        if (generated[k] || (angular.isArray(item[k]) && item[k].relate)) {
                            if (!noDeep) {
                                result[k] = item[k].toJSON(withoutId);
                            }
                        } else {
                            if (k.indexOf('$') !== 0 && k.indexOf('_') !== 0 && (!withoutId || k !== 'id') && !angular.isFunction(item[k])) {
                                result[k] = angular.copy(item[k]);
                            }
                        }
                    }
                    results.push(result);
                }, this);
                return results;
            },

            /**
             * Short hand for _.findWhere
             * @param query
             * @returns {*}
             */
            find: function (query) {
                return _(this).findWhere(query);
            },

            /**
             * Short hand for _.where
             * @param query
             * @returns {*}
             */
            filter: function (query) {
                return _(this).where(query);
            },

            /**
             * Short hand for _.where
             * @param query
             * @returns {*}
             */
            where: function (query) {
                return _(this).where(query);
            },

            /**
             * Short hand for _.reject
             * @param query
             * @returns {*}
             */
            reject: function (query) {
                return _(this).reject(query);
            },

            /**
             * Get item by id
             * @param id
             * @returns {*}
             */
            get: function (id) {
                if (angular.isObject(id)) {
                    id = id.id;
                }
                return _(this).findWhere({id: id});
            },

            /**
             * Get array index of given object or id
             * @param item
             * @returns {number|*|Number}
             */
            getIndex: function (item) {
                var res = angular.isObject(item) ? item : this.get(item);
                return this.indexOf(res);
            },

            /**
             * Remove items from collection
             * @param items
             */
            remove: function (item, preventDeleteChilds) {
                if (!angular.isObject(item)) {
                    item = this.get(item);
                }

                if (this.$relatedCollection) {
                    this.$relatedCollection.collection.remove(item);
                }

                var index = this.getIndex(item);
                if (index >= 0) {
                    this.splice(index, 1);
                    this.$generatedCollections.forEach(function (relation) {
                        if (!preventDeleteChilds) {
                            item[relation.name].reset();
                        }

                        var index = relation.collection.$childCollections.indexOf(
                            _(relation.collection.$childCollections).find(function (childCollection) {
                                return childCollection.collection.name == item[relation.name].name;
                            })
                        );
                        if (index >= 0) {
                            relation.collection.$childCollections.splice(index, 1);
                        }
                    });

                    this.$childCollections.forEach(function (childCollection) {
                        childCollection.collection.remove(item);
                    });

                    this.trigger(Triangle.EVENT.REMOVE, item);
                }
            },

            /**
             * add array
             * @param data
             */
            append: function (data) {
                Triangle.setData(this, data);
            },

            /**
             * Delete all items from this collection
             */
            reset: function (data) {
                while (this.length) {
                    this.remove(this[0], null, true);
                }
                /*
                 if(this.name.indexOf('=>') >= 0) {
                 //delete collections[this.name];
                 }
                 */
                if (data) {
                    Triangle.setData(this, data);
                }

                this.trigger(Triangle.EVENT.RESET);
                return this;
            },

            /**
             * Return first element
             */
            first: function () {
                return this[0] || null;
            },

            /**
             * Return last element
             */
            last: function () {
                return this.length ? this[this.length - 1] : null;
            },

            trigger: function (eventName) {
                if (typeof this.$events[eventName] != 'undefined') {
                    var args = Array.prototype.slice.call(arguments, 1);
                    this.$events[eventName].forEach(function (event) {
                        event[0].apply(event[1], args);
                    });
                }
            },

            on: function (eventName, handler, context) {
                if (typeof this.$events[eventName] == 'undefined') {
                    this.$events[eventName] = [];
                }

                if (angular.isFunction(handler) && !_(this.$events[eventName]).find(function (event) {
                        return handler == event[0];
                    })) {
                    this.$events[eventName].push([handler, context || this]);
                }
            },

            off: function (eventName, handler) {
                if (typeof this.$events[eventName] == 'undefined') {
                    return;
                }

                if (handler) {
                    var found = null;
                    if ((found = _(this.$events[eventName])).find(function (event) {
                            return handler == event[0];
                        })) {
                        this.$events[eventName].splice(this.$events[eventName].indexOf(found), 1);
                    }
                } else {
                    delete this.$events[eventName];
                }
            }
        };

        TriangleCollection.resetAll = function () {
            var markers = [];
            for (var k in collections) {
                if (k.indexOf('[') >= 0) {
                    markers.push(k);
                } else {
                    collections[k].reset();
                }
            }

            markers.forEach(function (name) {
                delete collections[name];
            });
        };

        /**
         * Create collection
         * @param collection
         * @param joins
         * @returns {*}
         */
        function TriangleCollection(name, defaults) {
            var collection = [];
            if (angular.isObject(name)) {
                defaults = name;
                name = 'Collection-' + Triangle.genId();
            }

            if (collections[name]) {
                //warning("Collection '" + name + "' already defined");
            }

            _.extend(collection, {
                name: name,
                $childCollections: [],
                $parentCollections: [],
                $generatedCollections: [],
                $relatedCollection: null,
                $parentCollection: null,
                $events: [],
                //parent: null,
                bind: [],
                defaults: defaults || {}
            }, COLLECTION);


            collections[name] = collection;
            return collection;
        }

        return TriangleCollection;
    })();

    var DEFAULT_DIRECTIVE_OPTIONS = {
        restrict: Triangle.DIRECTIVE_TYPE.ELEMENT,
        // here you can inject services into directive like $http, $rootScope, etc...
        inject: [],

        //append this classes '.myClass, .anotherClass' to directive
        classes: '',

        /*
         'click': function(event, scope, element, attrs){}
         or
         'click': 'onClickHandler' //this means you defined onClickHandler in options
         */
        events: {},

        // Local methods
        local: {},
        // Fires after event binded
        link: angular.noop,

        // Will fire on Angular.directive initialization
        init: angular.noop
    };

    /**
     * Convert string "a ,b ,c" into ['a','b','c']
     * @param string
     */
    var arrayFromString = function (string) {
        return string.split(',').map(function (item) {
            return item.trim();
        });
    };

    /**
     * Process and return function for angular.directive
     * @param name
     * @param options
     * @param triangle
     * @constructor
     */
    var DirectiveClass = function (name, options, triangle) {
        _.defaults(options, angular.copy(DEFAULT_DIRECTIVE_OPTIONS));
        _.extend(this, options, {
            name: name,
            triangle: triangle
        });

        var events = [];
        var localBind = {};
        var handler, eventName, eventTarget;

        var warningHandler = function (event) {
            return function () {
                warning("Handler for event '" + event + "' not found");
            };
        };

        // Generate events hash
        for (var event in this.events) {
            // handler described as function
            if (angular.isFunction(this.events[event])) {
                handler = this.events[event];
            } else {
                // handler described as string

                //check handler in local hash
                if (angular.isFunction(this.local[this.events[event]])) {
                    handler = this.local[this.events[event]];
                } else {
                    // check handler in whole object (has lower priority than local)
                    if (angular.isFunction(this[this.events[event]])) {
                        // Set bind this method as local
                        localBind[this.events[event]] = true;
                        handler = this[this.events[event]];
                    } else {
                        // bind handler with error
                        handler = warningHandler(event);
                    }
                }
            }

            eventName = event.split(' ');
            eventTarget = eventName[0] == event ? false : eventName.slice(1).join('').trim();

            events.push({
                name: eventName[0],
                target: eventTarget,
                handler: handler
            });
        }

        var optionsLink = this.link;
        var pathThrough = {};

        /**
         * Bind event handlers to options.events
         * @param scope
         * @param element
         * @param attrs
         */
        this.link = function (scope, element, attrs) {

            if (!this.directives) {
                this.directives = [];
            }

            var directive = {
                parent: this,
                $scope: scope,
                $element: element,
                $attrs: attrs
            };

            if (!angular.isArray(this.classes)) {
                this.classes = arrayFromString(this.classes);
            }

            this.classes.forEach(function (cssClass) {
                if (cssClass.trim()) {
                    element.addClass(cssClass);
                }
            });

            var key;
            for (key in pathThrough) {
                if (pathThrough[key] instanceof ServiceClass) {
                    directive[key] = pathThrough[key].create();
                }else{
                    if (key!=='$scope'){
                        directive[key] = pathThrough[key]
                    }
                }
            }

            //set local methods and properties

            if (angular.isObject(this.local)) {
                var through = null;

                for (key in this.local) {
                    switch (key) {
                        case 'scope':
                            break;
                        case 'delegated':
                            break;
                        case 'watch':
                            var handler;
                            for (var watchKey in this.local.watch) {
                                handler = angular.isFunction(this.local.watch[watchKey]) ?
                                    this.local.watch[watchKey] :
                                    this.local[this.local.watch[watchKey]];
                                if (angular.isFunction(handler)) {
                                    scope.$watch(watchKey, handler.bind(directive), true);
                                } else {
                                    warning('"' + watchKey + '" handler not found in watches hash! Check "' + this.local.watch[watchKey] + '" function');
                                }
                            }
                            break;
                        default:
                            directive[key] = angular.isFunction(this.local[key]) ?
                                this.local[key].bind(directive) :
                                angular.copy(this.local[key]);
                    }
                }

                if (angular.isObject(this.local.scope)) {
                    // inject local scope vars into $scope
                    for (var scopeVar in this.local.scope) {
                        if (directive[scopeVar]) {
                            // если в local находится тот же ключ, что и в скоупе, то
                            // перенаправляем переменную из локали в скоуп
                            scope[scopeVar] = directive[scopeVar];
                        } else {
                            // если в $scope есть уже переменная, обявленная с тем же именем,
                            // что и в local.scope, то портируем ее в this
                            if (scope[scopeVar]) {
                                directive[scopeVar] = scope[scopeVar];
                            } else {
                                // подготавливаем портирование из inject'a в скоуп
                                through = pathThrough[this.local.scope[scopeVar]];
                                if (through instanceof ServiceClass) {
                                    through = directive[this.local.scope[scopeVar]];
                                }
                                // если нечего портировать или ключ скоупа не найдет в inject'e
                                if (typeof through == 'undefined' || typeof through[scopeVar] == 'undefined') {
                                    // ставим в $scope переменную из local.scope
                                    scope[scopeVar] = angular.isFunction(this.local.scope[scopeVar]) ?
                                        this.local.scope[scopeVar].bind(directive) :
                                        angular.copy(this.local.scope[scopeVar]);
                                } else {
                                    // портируем inject'a переменную в $scope и в this
                                    directive[scopeVar] = scope[scopeVar] = through[scopeVar];
                                }
                            }
                        }
                    }
                }

                if (this.local.delegated) {
                    var delegated = angular.isArray(this.local.delegated) ? this.local.delegated : arrayFromString(this.local.delegated);
                    scope.delegated = scope.delegated || {$scope: scope};

                    delegated.forEach(function (key) {
                        if (typeof scope[key] === 'undefined') {
                            warning('"' + key + '" delegation is undefined in scope');
                        } else {
                            if (scope.delegated[key]) {
                                warning('"' + key + '" already registered in delegation');
                            }
                            scope.delegated[key] = scope[key];
                        }
                    });
                    directive.delegated = scope.delegated;
                }
            }

            if (scope.$parent && scope.$parent.delegated) {
                directive.delegated = scope.delegated = scope.$parent.delegated;
            }

            this.directives.push(directive);

            events.forEach(function (event) {
                var target = (event.target ? element[0].querySelectorAll(event.target) : element);
                if (target.length) {
                    Array.prototype.forEach.call(target, (function (handler, directive) {
                        return function (el) {
                            el['on' + event.name] = (function (handler, directive) {
                                return function (e) {
                                    handler.call(directive, e, scope, element, attrs);
                                    scope.$digest();
                                };
                            })(handler, directive);
                        };
                    })(event.handler, directive));
                } else {
                    warning("Target '" + event.target + "' for event '" + event.name + "' not found");
                }
            });

            optionsLink.call(directive, scope, element, attrs);
        };

        //Bind only non-event handlers
        for (var method in this) {
            if (typeof localBind[method] === 'undefined' && angular.isFunction(this[method])) {
                this[method] = this[method].bind(this);
            }
        }

        if (!angular.isArray(this.inject)) {
            this.inject = arrayFromString(this.inject);
        }

        this.inject.push('$compile');

        var injects = [], subs = {};
        this.inject.forEach(function (inject) {
            inject = inject.split(/\s+?as\s+?/gi);
            var name = inject[0].trim();
            injects.push(name);
            if (inject.length > 1) {
                subs[name] = inject[1].trim();
            }
        });

        /**
         * Init angular.directive
         */
        this.triangle.angular.directive(this.name, injects.concat([
            (function (directive, injects, subs) {
                return function () {
                    var args = arguments;
                    injects.forEach(function (item, index) {
                        directive[(subs[item] || item)] = args[index];
                        pathThrough[(subs[item] || item)] = args[index];
                    });
                    directive.init.apply(directive, args);
                    return directive;
                };
            })(this, injects, subs)
        ]));
    };

    /**
     * Angular directive shell
     * @param name
     * @param options
     */
    Triangle.prototype.directive = function (name, options) {
        if (typeof this.directives.name !== 'undefined') {
            warning('Directive named "' + name + '" already defined');
        }
        this.directives[name] = new DirectiveClass(name, options, this);
    };

    var DEFAULT_CONTROLLER_OPTIONS = {
        // here you can inject services into controller like $http, $rootScope, etc...
        // $scope will be injected automatically
        inject: [],
        // Will fire on Angular.controller initialization
        init: angular.noop,
        // Local methods
        local: {}
    };

    /**
     * Process and return function for angular.directive
     * @param name
     * @param options
     * @param triangle
     * @constructor
     */
    var ControllerClass = function (name, options, triangle) {
        _.defaults(options, angular.copy(DEFAULT_CONTROLLER_OPTIONS));
        _.extend(this, options, {
            name: name,
            triangle: triangle
        });

        var localBind = {};

        var optionsInit = this.init;
        var pathThrough = {};

        /**
         * Bind local options
         * @param scope
         */
        this.init = function (scope) {
            if (!this.controllers) {
                this.controllers = [];
            }

            var controller = {
                parent: this,
                $scope: scope
            };

            var key;
            for (key in pathThrough) {
                if (pathThrough[key] instanceof ServiceClass) {
                    controller[key] = pathThrough[key].create();
                }else{
                    if (key!=='$scope'){
                        controller[key] = pathThrough[key]
                    }
                }
            }

            //set local methods and properties
            if (angular.isObject(this.local)) {
                var through = null;
                var handler;

                for (key in this.local) {
                    switch (key) {
                        case 'scope':
                            // так как придется работать уже с назначенными переменными из local
                            // сначала копируем все в coontroller[key], а скоуп пока пропускаем
                            break;
                        case 'delegated':
                            break;
                        case 'watch':
                            for (var watchKey in this.local.watch) {
                                handler = angular.isFunction(this.local.watch[watchKey]) ?
                                    this.local.watch[watchKey] :
                                    this.local[this.local.watch[watchKey]];
                                if (angular.isFunction(handler)) {
                                    scope.$watch(watchKey, handler.bind(controller), true);
                                } else {
                                    warning('"' + watchKey + '" handler not found in watches hash! Check "' + this.local.watch[watchKey] + '" function');
                                }
                            }
                            break;
                        default:
                            controller[key] = angular.isFunction(this.local[key]) ?
                                this.local[key].bind(controller) :
                                angular.copy(this.local[key]);
                    }
                }

                if (angular.isObject(this.local.scope)) {
                    // inject local scope vars into $scope
                    for (var scopeVar in this.local.scope) {
                        if (controller[scopeVar]) {
                            // если в local находится тот же ключ, что и в скоупе, то
                            // перенаправляем переменную из локали в скоуп
                            scope[scopeVar] = controller[scopeVar];
                        } else {
                            // если в $scope есть уже переменная, обявленная с тем же именем,
                            // что и в local.scope, то портируем ее в this
                            if (scope[scopeVar]) {
                                controller[scopeVar] = scope[scopeVar];
                            } else {
                                // подготавливаем портирование из inject'a в скоуп
                                through = pathThrough[this.local.scope[scopeVar]];
                                if (through instanceof ServiceClass) {
                                    through = controller[this.local.scope[scopeVar]];
                                }
                                // если нечего портировать или ключ скоупа не найдет в inject'e
                                if (typeof through == 'undefined' || typeof through[scopeVar] == 'undefined') {
                                    // ставим в $scope переменную из local.scope
                                    scope[scopeVar] = angular.isFunction(this.local.scope[scopeVar]) ?
                                        this.local.scope[scopeVar].bind(controller) :
                                        angular.copy(this.local.scope[scopeVar]);
                                } else {
                                    // портируем inject'a переменную в $scope и в this
                                    controller[scopeVar] = scope[scopeVar] = through[scopeVar];
                                }
                            }
                        }
                    }
                }

                if (this.local.delegated) {
                    var delegated = angular.isArray(this.local.delegated) ? this.local.delegated : arrayFromString(this.local.delegated);
                    scope.delegated = scope.delegated || {$scope: scope};

                    delegated.forEach(function (key) {
                        if (typeof scope[key] === 'undefined') {
                            warning('"' + key + '" delegation is undefined in scope');
                        } else {
                            if (scope.delegated[key]) {
                                warning('"' + key + '" already registered in delegation');
                            }
                            scope.delegated[key] = scope[key];
                        }
                    });
                    controller.delegated = scope.delegated;
                }
            }

            if (scope.$parent && scope.$parent.delegated) {
                controller.delegated = scope.delegated = scope.$parent.delegated;
            }

            this.controllers.push(controller);
            optionsInit.call(controller, scope);
        };

        //Bind only non-event handlers
        for (var method in this) {
            if (typeof localBind[method] === 'undefined' && angular.isFunction(this[method])) {
                this[method] = this[method].bind(this);
            }
        }

        if (!angular.isArray(this.inject)) {
            this.inject = arrayFromString(this.inject);
        }

        //this.inject.push('$compile');
        this.inject.unshift('$scope');

        var injects = [], subs = {};
        this.inject.forEach(function (inject) {
            inject = inject.split(/\s+?as\s+?/gi);
            var name = inject[0].trim();
            injects.push(name);
            if (inject.length > 1) {
                subs[name] = inject[1].trim();
            }
        });

        /**
         * Init angular.directive
         */
        this.triangle.angular.controller(this.name, injects.concat([
            (function (controller, injects, subs) {
                return function () {
                    var args = arguments;
                    injects.forEach(function (item, index) {
                        controller[(subs[item] || item)] = args[index];
                        pathThrough[(subs[item] || item)] = args[index];
                    });
                    controller.init.call(controller, args[0]);
                    return controller;
                };
            })(this, injects, subs)
        ]));
    };

    /**
     * Angular directive shell
     * @param name
     * @param options
     */
    Triangle.prototype.controller = function (name, options) {
        if (typeof this.controllers.name !== 'undefined') {
            warning('Controller named "' + name + '" already defined');
        }
        this.controllers[name] = new ControllerClass(name, options, this);
    };


    /**
     * SYNC
     */
    var SYNC_PRIVATE = {
        onLoadSuccess: function (callback) {
            return (function (data) {
                var result = this.onBeforeLoadSuccess(data);
                result = this.onLoadSuccess(typeof result == 'undefined' ? data : result);
                this.loading = false;
                this.onAfterLoadSuccess(typeof result == 'undefined' ? data : result);
                if (angular.isFunction(callback)) {
                    callback(data);
                }
            }).bind(this);
        },

        onSaveSuccess: function (callback) {
            return (function (data) {
                this.saving = false;
                this.onSaveSuccess(data);
                if (angular.isFunction(callback)) {
                    callback(data);
                }
            }).bind(this);
        }
    };

    var SYNC = {
        loading: false,
        saving: false,

        load: function (callback) {

            this.loading = true;

            this.$http.post(this.url, {
                params: {
                    collection: this.syncName || this.name,
                    com: 'load',
                    filter: this.syncFilter
                }
            })
                .success(SYNC_PRIVATE.onLoadSuccess.bind(this)(callback))
                .error(this.onLoadError);
        },

        onBeforeLoadSuccess: angular.noop,

        onLoadSuccess: function (data) {
            data = data || null;
            this.reset(data);
            return data;
        },

        onAfterLoadSuccess: angular.noop,

        onLoadError: function () {
            warning("Can't load collection \"" + this.name + "\" from url " + this.url);
        },

        save: function (item, noDeep, callback) {
            this.saving = true;
            if (angular.isFunction(item)) {
                callback = item;
                item = null;
                noDeep = null;
            }

            if (angular.isFunction(noDeep)) {
                callback = noDeep;
                noDeep = null;
            }

            var json = this.toJSON(item, false, noDeep);
            var filter = angular.copy(this.syncFilter) || {};
            if (item) {
                filter.id = item.id;
            }

            if (Object.keys(filter).length) {
                json = json.map(function (item) {
                    return _.extend(item, filter);
                });
            }

            var params = {
                collection: this.syncName || this.name,
                com: 'save',
                filter: filter,
                data: json
            };

            if ((item = this.get(item))) {
                params.id = item.id;
            }

            this.$http.post(this.url, {
                params: params
            })
                .success(SYNC_PRIVATE.onSaveSuccess.bind(this)(callback))
                .error(this.onSaveError);
        },

        onSaveSuccess: angular.noop,
        onSaveError: function () {
            warning("Can't save collection \"" + this.name + "\" to url " + this.url);
        },

        destroy: function (item) {
            if (item) {
                item = this.get(item);
                var id = item.id;
                this.remove(item);
                this.$http.post(this.url, {
                    params: {
                        collection: this.syncName || this.name,
                        com: 'delete',
                        id: id,
                        filter: this.syncFilter
                    }
                }).success(this.onDestroySuccess)
                    .error(this.onDestroyError);
            } else {
                this.reset();
                this.save();
            }
        },

        onDestroySuccess: angular.noop,
        onDestroyError: function () {
            warning("Can't destroy item from collection \"" + this.name + "\" from url " + this.url);
        }
    };

    var DEFAULT_FACTORY_OPTIONS = {
        // here you can inject services into factory like $http, $rootScope, etc...
        inject: [],
        // Will fire on Angular.factory initialization
        init: angular.noop
    };

    /**
     * Process and return function for angular.factory
     * @param name
     * @param options
     * @param triangle
     * @constructor
     */
    var FactoryClass = function (name, options, triangle) {
        _.defaults(options, angular.copy(DEFAULT_FACTORY_OPTIONS));

        var sync = typeof options.url !== 'undefined';

        _.extend(this, options, {
            name: name,
            triangle: triangle
        });

        for (var k in this) {
            if (angular.isFunction(this[k])) {
                this[k] = this[k].bind(this);
            }
        }

        if (!angular.isArray(this.inject)) {
            this.inject = arrayFromString(this.inject);
        }

        if (sync) {
            this.inject.push('$http');
        }

        var factoryInjects = [], subs = {};
        this.inject.forEach(function (inject) {
            inject = inject.split(/\s+?as\s+?/gi);
            var name = inject[0].trim();
            factoryInjects.push(name);
            if (inject.length > 1) {
                subs[name] = inject[1].trim();
            }
        });


        /**
         * Init angular.factory
         */
        this.triangle.angular.factory(this.name, factoryInjects.concat([
            (function (factory, sync, factoryInjects, subs) {
                return function () {
                    var args = arguments;
                    factoryInjects.forEach(function (item, index) {
                        factory[(subs[item] || item)] = args[index];
                    });

                    if (angular.isObject(factory.collections)) {
                        for (var prop in factory.collections) {
                            factory[prop] = Triangle.collection(prop, factory.collections[prop]);
                            Triangle.sync(factory.$http, factory[prop], factory.url, factory.syncFilter, factory.syncName || prop);
                            /*
                             if (sync) {
                             for (var k in SYNC) {
                             factory[prop][k] = angular.isFunction(SYNC[k]) ? SYNC[k].bind(factory[prop]) : SYNC[k];
                             }
                             factory[prop].url = factory.url;
                             factory[prop].syncFilter = factory.syncFilter;
                             factory[prop].$http = factory.$http;
                             }
                             */
                        }
                    }

                    factory.init.apply(factory);
                    return factory;
                };
            })(this, sync, factoryInjects, subs)
        ]));
    };

    /**
     * Append server sync to collection
     * @param $http Sync object
     * @param collection
     * @param url
     * @param filter hash
     * @param name syncName
     */
    Triangle.sync = function($http, collection, url, filter, name){
        for (var k in SYNC) {
            collection[k] = angular.isFunction(SYNC[k]) ? SYNC[k].bind(collection) : SYNC[k];
        }
        collection.url = url;
        collection.syncFilter = filter;
        collection.syncName = name;
        collection.$http = $http;
    }

    /**
     * Angular factory shell
     * @param name
     * @param options
     */
    Triangle.prototype.factory = function (name, options) {
        if (typeof this.factories.name !== 'undefined') {
            warning('Factory named "' + name + '" already defined');
        }
        this.factories[name] = new FactoryClass(name, options, this);
    };

    var DEFAULT_SERVICE_OPTIONS = {
        // here you can inject services into factory like $http, $rootScope, etc...
        inject: [],
        // Will fire on Angular.factory initialization
        init: angular.noop
    };

    /**
     * Process and return function for angular.factory
     * @param name
     * @param options
     * @param triangle
     * @constructor
     */
    var ServiceClass = function (name, options, triangle) {
        var injects = {};

        _.defaults(options, angular.copy(DEFAULT_SERVICE_OPTIONS));

        var sync = typeof options.url !== 'undefined';

        var ServiceInstance = function () {
            this.id = Triangle.genId();
            _.extend(this, angular.copy(options), {
                name: name + '-' + this.id,
                triangle: triangle
            });

            var k;

            for (k in this) {
                if (angular.isFunction(this[k])) {
                    this[k] = this[k].bind(this);
                }
            }

            for (k in injects) {
                this[k] = injects[k];
            }

            if (angular.isObject(this.collections)) {
                for (var prop in this.collections) {
                    this[prop] = Triangle.collection(prop + '-' + this.id, this.collections[prop]);
                    if (sync) {
                        for (k in SYNC) {
                            this[prop][k] = angular.isFunction(SYNC[k]) ? SYNC[k].bind(this[prop]) : SYNC[k];
                        }
                        this[prop].url = this.url;
                        this[prop].syncFilter = this.syncFilter;
                        this[prop].syncName = prop;
                        this[prop].$http = this.$http;
                    }
                }
            }

            this.init(this);
        };

        this.create = function () {
            return new ServiceInstance();

        };

        this.inject = options.inject || [];

        if (!angular.isArray(this.inject)) {
            this.inject = arrayFromString(this.inject);
        }

        if (sync) {
            this.inject.push('$http');
        }

        var serviceInjects = [], subs = {};
        this.inject.forEach(function (inject) {
            inject = inject.split(/\s+?as\s+?/gi);
            var name = inject[0].trim();
            serviceInjects.push(name);
            if (inject.length > 1) {
                subs[name] = inject[1].trim();
            }
        });

        /**
         * Init angular.factory
         */
        triangle.angular.factory(name, serviceInjects.concat([
            (function (service, serviceInjects, subs) {
                return function () {
                    var args = arguments;
                    serviceInjects.forEach(function (item, index) {
                        service[(subs[item] || item)] = args[index];
                        injects[(subs[item] || item)] = args[index];
                    });
                    return service;
                };
            })(this, serviceInjects, subs)
        ]));
    };

    /**
     * Angular factory shell
     * @param name
     * @param options
     */
    Triangle.prototype.service = function (name, options) {
        if (typeof this.services.name !== 'undefined') {
            warning('Service named "' + name + '" already defined');
        }
        this.services[name] = new ServiceClass(name, options, this);
    };

    /**
     * Angular value shell
     * @param name
     * @param value
     */
    Triangle.prototype.value = function (name, value) {
        if (typeof this.values.name !== 'undefined') {
            warning('Value named "' + name + '" already defined');
        }
        this.values[name] = value;
        this.angular.value(name, value);
    };


    var DEFAULT_RUN_OPTIONS = {
        // here you can inject services into factory like $http, $rootScope, etc...
        inject: [],
        // Will fire on Angular.run initialization
        init: angular.noop
    };

    /**
     * Process and return function for angular.run
     * @param name
     * @param options
     * @param triangle
     * @constructor
     */
    var RunClass = function (options, triangle) {
        _.defaults(options, angular.copy(DEFAULT_RUN_OPTIONS));
        _.extend(this, options, {
            name: name,
            triangle: triangle
        });

        //Bind only non-event handlers
        for (var method in this) {
            if (angular.isFunction(this[method])) {
                this[method] = this[method].bind(this);
            }
        }

        if (!angular.isArray(this.inject)) {
            this.inject = arrayFromString(this.inject);
        }

        var injects = [], subs = {};
        this.inject.forEach(function (inject) {
            inject = inject.split(/\s+?as\s+?/gi);
            var name = inject[0].trim();
            injects.push(name);
            if (inject.length > 1) {
                subs[name] = inject[1].trim();
            }
        });

        /**
         * Init angular.directive
         */
        this.triangle.angular.run(injects.concat([
            (function (run, injects, subs) {
                return function () {
                    var args = arguments;
                    injects.forEach(function (item, index) {
                        run[(subs[item] || item)] = args[index];
                    });
                    run.init.call(run);
                };
            })(this, injects, subs)
        ]));
    };

    /**
     * Angular run shell
     * @param name
     * @param options
     */
    Triangle.prototype.run = function (options) {
        new RunClass(options, this);
    };

    /**
     * Initialize new Triangle and angular module
     * @param name
     * @param requires
     * @param configFn
     * @constructor
     */
    function Triangle(name, requires, routes, scope) {
        requires = requires || [];
        if (angular.isObject(routes)) {
            requires.push('ngRoute');
        }

        this.controllers = {};
        this.directives = {};
        this.factories = {};
        this.services = {};
        this.values = {};
        this.angular = angular.module(name, requires);

        if (angular.isObject(routes)) {
            this.angular.config([
                '$routeProvider', '$locationProvider', (function (routes) {
                    return function ($routeProvider, $locationProvider) {
                        for (var k in routes) {
                            if (k !== 'default') {
                                $routeProvider.when(k, routes[k]);
                            }
                        }
                        if (angular.isObject(routes.default)) {
                            $routeProvider.otherwise(routes.default);
                        }
                        $locationProvider.html5Mode(true);
                    };
                })(routes)
            ]);
        }

    }

    window.Triangle = Triangle;
})(window, angular, _);