/**
 * Created by misael on 31/03/2015.
 */

exports.circleci = function(payload){
    return{
        branch: payload.branch,
        url: payload.vcs_url
    }
};

exports.github = function(payload){
    return{
        branch: payload.ref.split('/').pop(),
        url: payload.repository.url
    }
};