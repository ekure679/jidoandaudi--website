(function ($) {
    'use strict';

    // Sticky Menu
    $(window).scroll(function () {
        if ($('header').offset().top > 10) {
            $('.top-header').addClass('hide');
            $('.navigation').addClass('nav-bg');
        } else {
            $('.top-header').removeClass('hide');
            $('.navigation').removeClass('nav-bg');
        }
    });

    // Background-images
    $('[data-background]').each(function () {
        $(this).css({
            'background-image': 'url(' + $(this).data('background') + ')'
        });
    });

    //Hero Slider
    $('.hero-slider').slick({
        autoplay: true,
        autoplaySpeed: 7500,
        pauseOnFocus: false,
        pauseOnHover: false,
        infinite: true,
        arrows: true,
        fade: true,
        prevArrow: '<button type=\'button\' class=\'prevArrow\'><i class=\'ti-angle-left\'></i></button>',
        nextArrow: '<button type=\'button\' class=\'nextArrow\'><i class=\'ti-angle-right\'></i></button>',
        dots: true
    });
    $('.hero-slider').slickAnimation();

    // venobox popup
    $(document).ready(function(){
        $('.venobox').venobox(); 
    });

    
    // mixitup filter
    var containerEl = document.querySelector('[data-ref~="mixitup-container"]');
    var mixer;
    if (containerEl) {
        mixer = mixitup(containerEl, {
            selectors: {
                target: '[data-ref~="mixitup-target"]'
            }
        });
    }

    //  Count Up
    function counter() {
        var oTop;
        if ($('.count').length !== 0) {
            oTop = $('.count').offset().top - window.innerHeight;
        }
        if ($(window).scrollTop() > oTop) {
            $('.count').each(function () {
                var $this = $(this),
                    countTo = $this.attr('data-count');
                $({
                    countNum: $this.text()
                }).animate({
                    countNum: countTo
                }, {
                    duration: 1000,
                    easing: 'swing',
                    step: function () {
                        $this.text(Math.floor(this.countNum));
                    },
                    complete: function () {
                        $this.text(this.countNum);
                    }
                });
            });
        }
    }
    $(window).on('scroll', function () {
        counter();
    });

    // Social Media Feed Management
    class SocialMediaFeeds {
        constructor() {
            this.updateInterval = 5 * 60 * 1000; // 5 minutes
            this.apiBaseUrl = 'http://localhost:3000/api'; // Change to your server URL
            this.useMockData = false; // Set to true for demo, false for real API calls
            this.init();
        }

        init() {
            this.loadAllFeeds();
            // Set up automatic refresh
            setInterval(() => {
                this.loadAllFeeds();
            }, this.updateInterval);
        }

        async loadAllFeeds() {
            try {
                await Promise.all([
                    this.loadTwitterFeed(),
                    this.loadFacebookFeed(),
                    this.loadLinkedInFeed()
                ]);
            } catch (error) {
                console.error('Error loading social media feeds:', error);
            }
        }

        async loadTwitterFeed() {
            const container = document.getElementById('twitter-feed');
            const countBadge = document.getElementById('twitter-count');
            
            try {
                let tweets;
                if (this.useMockData) {
                    tweets = await this.mockTwitterData();
                } else {
                    const response = await fetch(`${this.apiBaseUrl}/twitter`);
                    if (!response.ok) throw new Error('Failed to fetch Twitter data');
                    tweets = await response.json();
                }
                
                container.innerHTML = '';
                tweets.forEach(tweet => {
                    const tweetElement = this.createTweetElement(tweet);
                    container.appendChild(tweetElement);
                });
                
                countBadge.textContent = tweets.length;
            } catch (error) {
                console.error('Error loading Twitter feed:', error);
                container.innerHTML = '<div class="p-3 text-center text-danger">Unable to load tweets<br><small>Using demo data</small></div>';
                // Fall back to mock data if API fails
                const fallbackTweets = await this.mockTwitterData();
                container.innerHTML = '';
                fallbackTweets.forEach(tweet => {
                    const tweetElement = this.createTweetElement(tweet);
                    container.appendChild(tweetElement);
                });
                countBadge.textContent = fallbackTweets.length;
            }
        }

        async loadFacebookFeed() {
            const container = document.getElementById('facebook-feed');
            const countBadge = document.getElementById('facebook-count');
            
            try {
                let posts;
                if (this.useMockData) {
                    posts = await this.mockFacebookData();
                } else {
                    const response = await fetch(`${this.apiBaseUrl}/facebook`);
                    if (!response.ok) throw new Error('Failed to fetch Facebook data');
                    posts = await response.json();
                }
                
                container.innerHTML = '';
                posts.forEach(post => {
                    const postElement = this.createFacebookPostElement(post);
                    container.appendChild(postElement);
                });
                
                countBadge.textContent = posts.length;
            } catch (error) {
                console.error('Error loading Facebook feed:', error);
                container.innerHTML = '<div class="p-3 text-center text-danger">Unable to load posts<br><small>Using demo data</small></div>';
                // Fall back to mock data if API fails
                const fallbackPosts = await this.mockFacebookData();
                container.innerHTML = '';
                fallbackPosts.forEach(post => {
                    const postElement = this.createFacebookPostElement(post);
                    container.appendChild(postElement);
                });
                countBadge.textContent = fallbackPosts.length;
            }
        }

        async loadLinkedInFeed() {
            const container = document.getElementById('linkedin-feed');
            const countBadge = document.getElementById('linkedin-count');
            
            try {
                let posts;
                if (this.useMockData) {
                    posts = await this.mockLinkedInData();
                } else {
                    const response = await fetch(`${this.apiBaseUrl}/linkedin`);
                    if (!response.ok) throw new Error('Failed to fetch LinkedIn data');
                    posts = await response.json();
                }
                
                container.innerHTML = '';
                posts.forEach(post => {
                    const postElement = this.createLinkedInPostElement(post);
                    container.appendChild(postElement);
                });
                
                countBadge.textContent = posts.length;
            } catch (error) {
                console.error('Error loading LinkedIn feed:', error);
                container.innerHTML = '<div class="p-3 text-center text-danger">Unable to load updates<br><small>Using demo data</small></div>';
                // Fall back to mock data if API fails
                const fallbackPosts = await this.mockLinkedInData();
                container.innerHTML = '';
                fallbackPosts.forEach(post => {
                    const postElement = this.createLinkedInPostElement(post);
                    container.appendChild(postElement);
                });
                countBadge.textContent = fallbackPosts.length;
            }
        }

        // Mock data functions (replace with actual API calls)
        async mockTwitterData() {
            return [
                {
                    id: 1,
                    text: 'Exciting news! Our fishery program is now accepting applications for the 2026 semester. Learn sustainable fishing techniques! 🐟',
                    created_at: new Date().toISOString(),
                    user: { name: 'Blessed Jildo School', screen_name: 'blessedschool' }
                },
                {
                    id: 2,
                    text: 'Students in our tailoring program just completed their first fashion show! Amazing creativity and skill on display. 👗✂️',
                    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    user: { name: 'Blessed Jildo School', screen_name: 'blessedschool' }
                },
                {
                    id: 3,
                    text: 'Hair dressing workshop this Friday! Open to all current students. Book your spot now. 💇‍♀️',
                    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                    user: { name: 'Blessed Jildo School', screen_name: 'blessedschool' }
                }
            ];
        }

        async mockFacebookData() {
            return [
                {
                    id: 1,
                    message: 'Check out these amazing fish farming projects by our students! 🐟🌊',
                    created_time: new Date().toISOString(),
                    likes: { summary: { total_count: 45 } },
                    comments: { summary: { total_count: 12 } }
                },
                {
                    id: 2,
                    message: 'Graduation ceremony for our tailoring students - congratulations to all! 🎓',
                    created_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
                    likes: { summary: { total_count: 78 } },
                    comments: { summary: { total_count: 23 } }
                }
            ];
        }

        async mockLinkedInData() {
            return [
                {
                    id: 1,
                    text: 'Excited to share insights on vocational education and skill development in our community. The future belongs to those who invest in practical skills! 🎓',
                    created: new Date().toISOString(),
                    reactions: { summary: { total_count: 42 } }
                },
                {
                    id: 2,
                    text: 'Great networking session with industry professionals discussing career opportunities in fishery, tailoring, and beauty services. Amazing potential in these sectors!',
                    created: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                    reactions: { summary: { total_count: 67 } }
                },
                {
                    id: 3,
                    text: 'Proud to be part of the educational transformation happening at Blessed Jildo School. Our students are the future entrepreneurs and skilled professionals!',
                    created: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
                    reactions: { summary: { total_count: 89 } }
                }
            ];
        }

        createTweetElement(tweet) {
            const div = document.createElement('div');
            div.className = 'border-bottom p-3';
            div.innerHTML = `
                <div class="d-flex">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${tweet.user.name} <small class="text-muted">@${tweet.user.screen_name}</small></h6>
                        <p class="mb-2">${tweet.text}</p>
                        <small class="text-muted">${this.timeAgo(tweet.created_at)}</small>
                    </div>
                    <div class="ml-2">
                        <i class="ti-twitter-alt text-primary"></i>
                    </div>
                </div>
            `;
            return div;
        }

        createFacebookPostElement(post) {
            const div = document.createElement('div');
            div.className = 'border-bottom p-3';
            div.innerHTML = `
                <div class="d-flex">
                    <div class="flex-grow-1">
                        <p class="mb-2">${post.message}</p>
                        <div class="d-flex justify-content-between">
                            <small class="text-muted">${this.timeAgo(post.created_time)}</small>
                            <div>
                                <span class="badge badge-light mr-1">👍 ${post.likes.summary.total_count}</span>
                                <span class="badge badge-light">💬 ${post.comments.summary.total_count}</span>
                            </div>
                        </div>
                    </div>
                    <div class="ml-2">
                        <i class="ti-facebook" style="color: #1877f2;"></i>
                    </div>
                </div>
            `;
            return div;
        }

        createLinkedInPostElement(post) {
            const div = document.createElement('div');
            div.className = 'border-bottom p-3';
            div.innerHTML = `
                <div class="d-flex">
                    <div class="flex-grow-1">
                        <p class="mb-2">${post.text}</p>
                        <div class="d-flex justify-content-between">
                            <small class="text-muted">${this.timeAgo(post.created)}</small>
                            <span class="badge badge-light">👍 ${post.reactions.summary.total_count}</span>
                        </div>
                    </div>
                    <div class="ml-2">
                        <i class="ti-linkedin" style="color: #0077b5;"></i>
                    </div>
                </div>
            `;
            return div;
        }

        timeAgo(dateString) {
            const now = new Date();
            const past = new Date(dateString);
            const diffMs = now - past;
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffMins = Math.floor(diffMs / 60000);

            if (diffHrs > 0) {
                return `${diffHrs}h ago`;
            } else if (diffMins > 0) {
                return `${diffMins}m ago`;
            } else {
                return 'Just now';
            }
        }
    }

    // Initialize social media feeds when document is ready
    $(document).ready(function() {
        new SocialMediaFeeds();
    });

})(jQuery);