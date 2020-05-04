import { SET_SCREAMS, LIKE_SCREAM, UNLIKE_SCREAM, LOADING_DATA } from '../types';

const initialLState = {
    screams: [],
    scream: {},
    loading: false
};

export default function(state = initialLState, action){
    switch(action.type){
        case LOADING_DATA:
            return{
                ...state,
                loading: true
            }
        case SET_SCREAMS:
            return {
                ...state,
                screams: action.payload,
                loading: false
            }
        case LIKE_SCREAM:
        case UNLIKE_SCREAM:
            let index = state.scream.findIndex((scream) => scream.screamId === action.payload.screamId);
            state.screams[index] = action.payload;
            return {
                ...state,
            }
        default:
            return state;
    }

}