require "webrick"
require 'jekyll'

module Jekyll
  module Commands
    class Serve
      class Servlet < WEBrick::HTTPServlet::FileHandler
        # original: webrick/httpservlet/filehandler.rb
        def prevent_directory_traversal(req, res)
            # just change encoding "filesystem" to "utf-8"
            path = req.path_info.dup.force_encoding(Encoding.find("utf-8"))
            if trailing_pathsep?(req.path_info)
              expanded = File.expand_path(path + "x")
              expanded.chop!
            else
              expanded = File.expand_path(path)
            end
            expanded.force_encoding(req.path_info.encoding)
            req.path_info = expanded
        end
      end
    end
  end
end



# Remove CGI.escape from CategoryPages

module Jekyll
  module CategoryPages

    # Custom generator for generating all index pages based on a supplied layout.
    #
    # Note that this generator uses a layout instead of a regular page template, since
    # it will generate a set of new pages, not merely variations of a single page like
    # the blog index Paginator does.
    class Pagination


      # Generate the paginated category pages.
      #
      # site               - The Site object.
      # category_base_path - String with the base path to the category index pages.
      # category_layout    - The name of the basic category layout page.
      def generate_paginated_categories(site, category_base_path, category_layout)
        categories = sorted_categories site

        # Generate the pages
        for category in categories
          posts_in_category = site.categories[category]
          category_path = File.join(category_base_path, category)
          per_page = site.config['paginate']

          page_number = CategoryPager.calculate_pages(posts_in_category, per_page)
          page_paths = []
          category_pages = []
          (1..page_number).each do |current_page|
            # Collect all paths in the first pass and generate the basic page templates.
            page_name = current_page == 1 ? INDEXFILE : "page#{current_page}.html"
            page_paths.push page_name
            new_page = CategoryIndexPage.new(site, category_path, page_name, category, category_layout, posts_in_category, true)
            category_pages.push new_page
          end

          (1..page_number).each do |current_page|
            # Generate the paginator content in the second pass.
            previous_link = current_page == 1 ? nil : page_paths[current_page - 2]
            next_link = current_page == page_number ? nil : page_paths[current_page]
            previous_page = current_page == 1 ? nil : (current_page - 1)
            next_page = current_page == page_number ? nil : (current_page + 1)
            category_pages[current_page - 1].add_paginator_relations(current_page, per_page, page_number,
                                                                     previous_link, next_link, previous_page, next_page)
          end

          for page in category_pages
            # Finally, add the new pages to the site in the third pass.
            site.pages << page
          end
        end

        Jekyll.logger.debug("Paginated categories", "Processed " + categories.size.to_s + " paginated category index pages")
      end

      # Generate the non-paginated category pages.
      #
      # site               - The Site object.
      # category_base_path - String with the base path to the category index pages.
      # category_layout    - The name of the basic category layout page.
      def generate_categories(site, category_base_path, category_layout)
        categories = sorted_categories site

        # Generate the pages
        for category in categories
          posts_in_category = site.categories[category]
          category_path = File.join(category_base_path, category)

          site.pages << CategoryIndexPage.new(site, category_path, INDEXFILE, category, category_layout, posts_in_category, false)
        end

        Jekyll.logger.debug("Categories", "Processed " + categories.size.to_s + " category index pages")
      end

    end
  end

end
