# ASCII SOFT Redmine WYSIWYG Editor
# License: GPL-2.0-or-later (bundled third-party libraries: see THIRD_PARTY_NOTICES.md)

Redmine::Plugin.register :asciisoft_redmine_editor do
  name 'ASCII SOFT WYSIWYG 편집기'
  author 'ASCII SOFT'
  description 'Markdown 편집 칸을 WYSIWYG 편집기로 대체합니다'
  version '1.3.0'
  url 'https://asciisoft.com'
  requires_redmine version_or_higher: '7.0.0'
  settings default: {
    'enabled' => '1', 'default_font' => 'Segoe UI', 'default_font_size' => '14',
    'show_wysiwyg' => '1', 'show_markdown' => '1', 'comment_editor' => '1'
  }, partial: 'settings/asciisoft_redmine_editor'
end

module AsciisoftRedmineEditor
  FONT_BASE = ['Consolas', 'Tahoma', 'Arial', 'Impact', 'Segoe UI', 'Courier New', 'Verdana', 'Sans-serif', 'Times New Roman'].freeze
  FONT_KO = ['맑은 고딕', '굴림', '돋움', '바탕', '궁서'].freeze
  # 모듈(화면)별 세로 크기를 따로 지정할 수 있는 입력칸
  MODULE_KEYS = %w[issue_description issue_notes news_description news_comment message wiki document project].freeze
  FONT_SIZES = [7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 24, 28, 32, 38, 45, 48, 72, 99].freeze

  class Hooks < Redmine::Hook::ViewListener
    PLUGIN = 'asciisoft_redmine_editor'.freeze

    def view_layouts_base_html_head(_context = {})
      return '' unless Setting.text_formatting == 'common_mark'
      return '' unless User.current.logged?
      s = Setting.plugin_asciisoft_redmine_editor || {}
      return '' unless s['enabled'].to_s == '1'

      ko = current_language.to_s.start_with?('ko')
      fonts = AsciisoftRedmineEditor::FONT_BASE + (ko ? AsciisoftRedmineEditor::FONT_KO : [])
      font = fonts.include?(s['default_font'].to_s) ? s['default_font'].to_s : 'Segoe UI'
      size = AsciisoftRedmineEditor::FONT_SIZES.include?(s['default_font_size'].to_i) ? s['default_font_size'].to_i : 14
      heights = {}
      AsciisoftRedmineEditor::MODULE_KEYS.each do |k|
        next unless s["height_#{k}_on"].to_s == '1'

        h = s["height_#{k}"].to_i
        heights[k] = h if h.between?(120, 2000)
      end

      config = {
        bundle: asset_path("plugin_assets/#{PLUGIN}/toastui-editor-bundle.min.js"),
        css: asset_path("plugin_assets/#{PLUGIN}/toastui-editor.css"),
        lang: current_language.to_s.start_with?('ko') ? 'ko-KR' : 'en-US',
        defaultFont: font,
        defaultFontSize: size,
        heights: heights,
        koFonts: ko,
        commentEditor: s.fetch('comment_editor', '1').to_s == '1',
        showWysiwyg: s.fetch('show_wysiwyg', '1').to_s == '1',
        showMarkdown: s.fetch('show_markdown', '1').to_s == '1',
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
          imageLabel: l(:asciisoft_editor_image),
          prevItem: l(:asciisoft_editor_prev_font),
          nextItem: l(:asciisoft_editor_next_font),
          sizeUp: l(:asciisoft_editor_size_up),
          sizeDown: l(:asciisoft_editor_size_down),
          editorTab: l(:asciisoft_editor_tab),
          mdNoticeNoSwitch: l(:asciisoft_editor_md_notice_no_switch),
          ok: l(:asciisoft_editor_ok),
          cancel: l(:asciisoft_editor_cancel),
          dialogInvalid: l(:asciisoft_editor_dialog_invalid)
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
