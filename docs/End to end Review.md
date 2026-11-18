End to end Review:

1. Under Profile --> Insights --> 'Generate Draft' took some 45 seconds, found Polaris wheel rotating, but no streaming action found there.
2. "Open questions: The sources do not answer these. Add a source or answer them in the questionnaire." --> Where to add the answers to this questionnaire? 
3. Problem: When i click on 'Apply to profile' button in 'Insights' tab, the tabs is shifted from Insights --> Profile again. Which is confusing and the customers would keep jumping between the tabs. 
Solution: There should be natural dataflow design, so that forward transition becomes easier. There shouldn't be such back and forth traversing. The 'Apply to profile' button should apply the business insights to the given profile and show the 'Profile' tab next (after the Insights tab). Whereas the first tab should be 'Business info' rather than 'Profile'. Business info should show the 'Basic' card only. 'Positioning' and 'Writing samples' should be shown in 4th tab 'Profile' tab. So reorder the tabs as fol: 1) Business info, 2) Sources, 3) Insights, 4) Profile, 5) ICP
4. When the 'Apply to profile' button is clicked and insights are applied to the profile, it should go grey and non-clickable. Whenever, a new data, insights, info is arrived, it should turn active and clickable. 
5. Make the ICP cards more interactive and easier to make the ICP. Such as in each card, add grey suggestive example texts which fades away when user clicks inside the card. 
6. Company search and Researching in 'Intelligence' takes too much time. How to reduce this time? Otherwise, this would break the Vercel's 300s rule.
7. Find companies or search companies should give me at least 10 company search results to work on ahead.
8. Dashboard should have two tabs: 'Main' and 'Table view'. 'Main' tab should also show a donut pie chart, showing leads by industry segment. Categorize the industry segment based on the profile insights and business info of the profile. the second tab 'Table view' should show all the companies in tabular format, each row showing one company. Add a dropdown menue for sorting the data in terms of: Recent, Oldest, Segment, Status, Region  [Segment means industry segment; Status means contacted, meeting booked, won/lost...etc]. The Table view will have fol columns: Company, Segment, Status, Main email, Notes. Make the company names clickable in the table view. Add editable fields in the Notes column to add any relevant notes for that company. Add a search bar to search a company or region from the table, place this search bar above this Table view, add filters to narrowdown the search results such as: Segment, Status, Date added
9. Discover --> Discovery --> Suggestions --> Companies to review should fisrt show in a tabular format and all company detailed cards should show collapsed, with a downarrow to open each one. The tabular format should show Company, Industry segment, Company size, Location columns.
10. Add SEO and its features from day one. Plan it and implement it.




