const States = require('../models/States');
const statesJSON = require('../routes/api/states');

async function UpdateDBWithStatesAndCities() {
    const allStates = await States.find();
    // console.log(allStates)
    for(let state of allStates){
        let thisState = state;
        console.log(`\n${thisState.name}\n`)
        for(let stateJSON of statesJSON){
            if(thisState.name === stateJSON.state_code){
                // console.log(`db state: ${state.name} | json name: ${stateJSON.name}`)
                thisState.fullName = stateJSON.name;
                // now get cities
                // console.log(state.cities.map((name)=>name.name))
                for(let cityJSON of stateJSON.cities){
                    if(!thisState.cities.map((name)=>name.name).includes(cityJSON.name)){
                        console.log(`${thisState.fullName} is missing ${cityJSON.name}`)
                        thisState.cities.push(cityJSON)
                    }
                }
            }
            // console.log(`json name: ${stateJSON.name}`)
        }
        
        // if(state.cities.length < 3){
            
        // }else{
        //     console.log(`!!!!!!! ${state.name} does not have cities`)
        // }
        // await thisState.save();
    }
    // await allStates.save();
}

module.exports = {
    UpdateDBWithStatesAndCities: UpdateDBWithStatesAndCities,
}