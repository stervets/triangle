GENDER =
    NONE: 0
    MALE: 1
    FEMALE: 2

rand = (min, max)->
    [max, min]=[min, 0] unless max?
    Math.floor(Math.random() * (max - min + 1)) + min

app = new Triangle 'TriangleDemo'


app.factory 'MainFactory',
    collections:
        rooms:
            name: ''
            genderRestrict: GENDER.NONE
            ageLimit: 0

        people:
            roomId: null
            name: ''
            gender: GENDER.MALE
            age: 0
            $edit: false

    onAddPeople: (man)->
        man.age = rand(1,80) unless man.age
        man.gender = (if rand(1) then GENDER.MALE else GENDER.FEMALE) unless man.gender
        man.name = (if man.gender is GENDER.MALE then 'Male' else 'Female')+" #{rand(100, 999)}" unless man.age

    onAddRoom: (room)->
        room.name = "Room ##{rand(100, 999)}"unless room.name

    init: ->
        @people.on Triangle.EVENT.ADD, @onAddPeople
        @rooms.on Triangle.EVENT.ADD, @onAddRoom

        @rooms.setChildCollection
            collection: 'people'
            name: 'people'
            bind:
                id: 'roomId'
            separator: (man)-> man.age<=@ageLimit and (@genderRestrict is GENDER.NONE or man.gender is @genderRestrict)

app.controller 'MainController',
    inject: 'MainFactory as model'
    scope:
        rooms: 'model'
        people: 'model'

app.directive 'room',
    restrict: Triangle.DIRECTIVE_TYPE.ELEMENT
    templateUrl: 'jsRoomTemplate'
    transclude: true
    scope:
        room: '='
        removable: '='
    local:
        scope:
            room: 'Scope'

    link: ->
        console.log @room, @$scope.room, @$scope.removable?

