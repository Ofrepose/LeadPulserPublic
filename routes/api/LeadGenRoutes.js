const express = require('express');
const router = express.Router();

// helpers
const leadGen = require('./LeadGen');
const researchSEO = require('./LeadGen/ResearchSEO');

// get Middleware
const auth = require('../../middleware/auth');

const url = require('url');
const querystring = require('querystring');

// get Models
const User = require('../../models/LeadGenUser');
const Websites = require('../../models/WebsitesNew');
const Accessibility = require('../../models/Accessibility');

const log = new (require('../../helpers/logs/Logger'))({});



router.put('/addList', auth, async (req, res) => {
    log.info('/addList')
    thisUser = await User.findById(req.user.id).select('-password');

    if (!thisUser) {

        return res.status(404).json({ msg: 'User not found' });

    };
    const listName = req.body.listName;

    return res.send(await leadGen.CreateNewListForUser(listName, thisUser));
});


router.get('/filters', async (req, res) => {
    const filterOptions = await leadGen.BuildInitial();
    return res.send(filterOptions);
});


router.put('/filterConditionals', auth, async (req, res) => {
    const filterConditionals = req.body;
    const thisUser = await User.findById(req.user.id).select('-password');
    if (!thisUser) {

        return res.status(404).json({ msg: 'User not found' });

    };

    try{
        const results = await leadGen.GetValuesByFilter({ filterConditionals, user: thisUser, update: false });
        return res.send(results)
    }catch(err){
        return res.status(400).json({ errors: [{ msg: 'Error getting Results' }] });
    }
});


router.get('/locations', async (req, res) => {
    const results = await Websites.aggregate([
        { $match: {
          stateName: { $exists: true, $ne: "" },
          cityName: { $exists: true, $ne: "" }
        }},
        { $group: {
          _id: "$stateName",
          cityNames: { $addToSet: "$cityName" }
        }},
        { $project: {
          _id: 0,
          stateName: "$_id",
          cityNames: 1
        }},
        { $sort: {
          stateName: 1,
          cityNames: 1
        }}
      ], function(err, results) {
        if (err) {
          console.log(err);
        } else {
          // Sort the cityNames arrays by the first letter of cityName in alphabetical order
          results.forEach(function(state) {
            state.cityNames.sort(function(a, b) {
              return a.charAt(0).localeCompare(b.charAt(0));
            });
          });
          // Sort the entire results array by the first letter of the first cityName in alphabetical order
          results.sort(function(a, b) {
            return a.cityNames[0].charAt(0).localeCompare(b.cityNames[0].charAt(0));
          });
        }
      });
      
    return res.send(results);
})

router.put('/moveLead', auth, async (req, res) => {
    const leadsData = req.body;
    const thisUser = await User.findById(req.user.id).select('-password');
    if (!thisUser) {

        return res.status(404).json({ msg: 'User not found' });

    };
    try {
        const listOriginal = thisUser.lists.filter((list) => list.id === leadsData.oldListId)[0]

        let indexesForOriginal = leadGen.getWebsiteIndexInList({ websites: leadsData.websitesToMove, list: listOriginal })
        const newListForOriginal = thisUser.lists.filter((list) => list.id === leadsData.oldListId)[0].websites.filter((item, index) => {
            return !indexesForOriginal.includes(index);
        });
        const websitesToMove = thisUser.lists.filter((list) => list.id === leadsData.oldListId)[0].websites.filter((item, index) => {
            return indexesForOriginal.includes(index);
        });
        thisUser.lists.filter((list) => list.id === leadsData.oldListId)[0].websites = newListForOriginal;
        thisUser.lists.filter((list) => list.id === leadsData.newListId)[0].websites = [...thisUser.lists.filter((list) => list.id === leadsData.newListId)[0].websites, ...websitesToMove];
        await thisUser.save();
    } catch (err) {
        console.log(err)
    }

    return res.send(thisUser);
});

router.put('/deleteLead', auth, async (req, res) => {
    const leadsData = req.body;
    const thisUser = await User.findById(req.user.id).select('-password');
    if (!thisUser) {

        return res.status(404).json({ msg: 'User not found' });

    };
    try {

        const listToEdit = thisUser.lists.filter((list) => list.id === leadsData.listId)[0];
        const remainingWebsites = listToEdit.websites.filter((item) => !leadsData.websitesToDelete.includes(item.websiteId));

        thisUser.lists.filter((list) => list.id === leadsData.listId)[0].websites = remainingWebsites;

        await thisUser.save();
    } catch (err) {
        console.log(err)
    }

    return res.send(thisUser);
});

router.put('/deleteList', auth, async (req, res) => {
    const leadsData = req.body;
    const thisUser = await User.findById(req.user.id).select('-password');
    if (!thisUser) {

        return res.status(404).json({ msg: 'User not found' });

    };
    try {
        const listToRemove = thisUser.lists.filter((list) => list.id === leadsData.listId);
        if (listToRemove[0].name === thisUser.activeDefaultList) {
            thisUser.activeDefaultList = 'default';
        }
        const remainingLists = thisUser.lists.filter((list) => list.id !== leadsData.listId);

        thisUser.lists = remainingLists

        await thisUser.save();
    } catch (err) {
        console.log(err)
    }

    return res.send(thisUser);
});

router.put('/activeList', auth, async (req, res) => {
    thisUser = await User.findById(req.user.id).select('-password');

    if (!thisUser) {

        return res.status(404).json({ msg: 'User not found' });

    };

    const listName = req.body.listName;

    thisUser.activeDefaultList = listName;

    await thisUser.save()

    return res.send(thisUser)

});


// RESEARCH - 

// TO-DO Refactor into another router file

router.put('/lighthouse', auth, async (req, res) => {
    try {
        thisUser = await User.findById(req.user.id).select('-password');

        if (!thisUser) {
            return res.status(404).json({ msg: 'User not found' });
        };
    } catch (err) {
        log.error(`failed to get researched in /getResearch: \n${err}`)
    }


    const thisUserReturn = await researchSEO.getSpeedInsightData({ thisUser, siteId: req.body.siteId });
    return res.send(thisUserReturn)
})

router.get('/getResearch', auth, async (req, res) => {
    try {
        thisUser = await User.findById(req.user.id).select('-password');

        if (!thisUser) {
            return res.status(404).json({ msg: 'User not found' });
        };
        return res.send(thisUser.researched)
    } catch (err) {
        log.error(`failed to get researched in /getResearch: \n${err}`)
    }


})


// TODO - Pull out and refactor the logic from this. It's too long and does more than one thing.
router.put('/website/add', auth, async (req, res) => {
    try {
        let thisUser = await User.findById(req.user.id).select('-password');

        if (!thisUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // removing research from this
        let websiteGrabUpdated = await leadGen.GetWebsiteById({ id: req.body.id });
        let websiteResearched = websiteGrabUpdated.length ? websiteGrabUpdated[0] : websiteGrabUpdated;
        

        if (!websiteResearched.score && websiteResearched.score !== 0) {
            return res.status(500).send('no score available');
        }
        const websiteResearchedTrim = {
            websiteId: websiteResearched._id,
            dateResearched: new Date(),
            name: websiteResearched.domain,
            score: websiteResearched.score,
        };

        let activeList;

        if (thisUser.lists.length > 1 && thisUser.activeDefaultList !== 'default') {
            activeList = thisUser.lists.findIndex((element) => element.name === thisUser.activeDefaultList);

            const websiteIdsInActiveList = thisUser.lists[activeList]?.websites?.length && thisUser.lists[activeList].websites.length && thisUser.lists[activeList].websites.map((item) => item.websiteId);

            if (!websiteIdsInActiveList.length || !websiteIdsInActiveList.includes(websiteResearched._id)) {
                log.info(`Adding ${websiteResearched.domain} to ${thisUser.lists[activeList].name}`);
                await User.findOneAndUpdate(
                    { _id: thisUser._id, "lists._id": thisUser.lists[activeList]._id },
                    { $push: { "lists.$.websites": websiteResearchedTrim } },
                    { new: true }
                );
               
            } else {
                log.info(`${websiteResearched.domain} already added to ${thisUser.lists[activeList].name}`);
            }
        } else {
            activeList = thisUser.lists;

            const websiteIdsInActiveList = thisUser.lists[0].websites.length && thisUser.lists[0].websites.map((item) => item.websiteId);

            if (!websiteIdsInActiveList.length) {
                await User.findOneAndUpdate(
                    { _id: thisUser._id, "lists._id": thisUser.lists[0]._id },
                    { $push: { "lists.$.websites": websiteResearchedTrim } },
                    { new: true }
                );
            } else if (!websiteIdsInActiveList.includes(websiteResearched._id)) {
                log.info(`Adding ${websiteResearched.domain} to ${thisUser.lists[0].name}`);
                await User.findOneAndUpdate(
                    { _id: thisUser._id, "lists._id": thisUser.lists[0]._id },
                    { $push: { "lists.$.websites": websiteResearchedTrim } },
                    { new: true }
                );
            } else {
                log.info(`${websiteResearched.domain} already added to ${thisUser.lists[0].name}`);
            }
        }

        thisUser = await User.findById(req.user.id).select('-password');
        thisUser.credits -= 1;
        await thisUser.save();
        const websitesResearchedIds = thisUser?.lists.reduce((acc, list) => {
            const listWebsiteIds = list.websites.map((website) => website.websiteId);
            return [...acc, ...listWebsiteIds];
        }, []);
        const websitesResearched = await Websites.find({ _id: { $in: websitesResearchedIds } }).select('-accessibilityIssues');

        thisUser.websitesResearched = websitesResearched;
        return res.send({ ...thisUser._doc, websitesResearched });
    } catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
});


router.get('/websites/researched', auth, async (req, res) => {
    try {
        let thisUser = await User.findById(req.user.id).select('-password');

        if (!thisUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const websitesResearchedIds = thisUser?.lists.reduce((acc, list) => {
            const listWebsiteIds = list.websites.map((website) => website.websiteId);
            return [...acc, ...listWebsiteIds];
        }, []);
        const websitesResearched = await Websites.find({ _id: { $in: websitesResearchedIds } }).select('-accessibilityIssues')

        return res.send({ websitesResearched });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }

});


router.get('/websites/accessibility', auth, async (req, res) => {
    try {
        const { pathname, query } = url.parse(req.url);
        const params = querystring.parse(query);

        const domain = params.domain;

        let thisUser = await User.findById(req.user.id).select('-password');

        if (!thisUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const Accessibilities = await Accessibility.find({ domain: domain })

        return res.send(Accessibilities[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})




module.exports = router;