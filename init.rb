# ASCII SOFT Redmine WYSIWYG Editor
# License: GPL-2.0-or-later (bundled third-party libraries: see THIRD_PARTY_NOTICES.md)

Redmine::Plugin.register :asciisoft_redmine_editor do
  name 'ASCII SOFT WYSIWYG 편집기'
  author 'ASCII SOFT'
  description 'Markdown 편집 칸을 WYSIWYG 편집기로 대체합니다'
  version '1.1.0'
  url 'https://asciisoft.com'
  requires_redmine version_or_higher: '7.0.0'
  settings default: { 'enabled' => '1' }, partial: 'settings/asciisoft_redmine_editor'
end

module AsciisoftRedmineEditor
  class Hooks < Redmine::Hook::ViewListener
    PLUGIN = 'asciisoft_redmine_editor'.freeze

    def view_layouts_base_html_head(_context = {})
      return '' unless Setting.text_formatting == 'common_mark'
      return '' unless User.current.logged?
      return '' unless (Setting.plugin_asciisoft_redmine_editor || {})['enabled'].to_s == '1'

      config = {
        bundle: asset_path("plugin_assets/#{PLUGIN}/toastui-editor-bundle.min.js"),
        css: asset_path("plugin_assets/#{PLUGIN}/toastui-editor.css"),
        labels: {
          issueLink: l(:asciisoft_editor_issue_link),
          issuePrompt: l(:asciisoft_editor_issue_prompt),
          wikiLink: l(:asciisoft_editor_wiki_link),
          wikiPrompt: l(:asciisoft_editor_wiki_prompt),
          noAttach: l(:asciisoft_editor_no_attach),
          tooMany: l(:asciisoft_editor_too_many),
          mdNotice: l(:asciisoft_editor_md_notice),
          fontFamily: l(:asciisoft_editor_font_family),
          fontSize: l(:asciisoft_editor_font_size),
          lineHeight: l(:asciisoft_editor_line_height),
          defaultValue: l(:asciisoft_editor_default),
          imageLabel: l(:asciisoft_editor_image)
        }
      }
      safe_join([
        javascript_tag("window.AsciisoftEditorConfig = #{config.to_json};"),
        stylesheet_link_tag('asciisoft_editor', plugin: PLUGIN),
        javascript_include_tag('asciisoft_editor', plugin: PLUGIN, defer: true)
      ], "\n")
    end
  end
end
